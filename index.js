const express        = require('express');
const mongoose       = require('mongoose');
const bodyParser     = require('body-parser');
const app            = express();
const cors           = require('cors')
const jwt            = require('jsonwebtoken')
const dotenv         = require('dotenv')
const moment         = require('moment')

dotenv.config()
const DBAccess = require('./DBAccess')
const repository = require('./repository')
const { User, Show, Card, Seats, Ticket } = DBAccess

mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true})

const db = mongoose.connection;
db.on('Error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Successfully connected to DB')
})

app.use(cors());
app.use(bodyParser.json())

app.get('/', (req, res) => {
    res.send('server running')
})

app.post('/session', async (req, res) => {
    const token = jwt.verify(req.headers.authorization, process.env.KEY)
    if (token) {
        res.send({ message: 'ok'} )
    } else {
        res.send({ message: 'sessionExpired'} )
    }
})
app.post('/signup', async (req, res) => {
    const {username, email, password} = req.body
    let users = await User.find({})
    let lastId = users.map(u => u.userId).sort()[users.length - 1]
    console.log('id: ', lastId)
    const user = new User({ userId: ++lastId, username, email, password})
    user.save().then(result => {
        if(result._id){
            try {
                const payload = {
                    userId: lastId,
                    maxAge: moment().add(15, 'minutes')
                }
                const token = jwt.sign(payload, process.env.KEY, {expiresIn: 900})
                res.send({message: "userCreated", token})
            }
            catch (e) {
                console.error(e)
                res.sendStatus(401)
            }
        }
    })
        .catch(err => {
            console.log('Front data: ', req.body)
            res.send({err})
        })
})
app.post('/auth', async (req, res) => {
    const { username, password, secretAdminUUID } = req.body
    console.log('Auth Data: ', req.body)
    if ( secretAdminUUID === process.env.ADMIN_UUID ) {
        const payload = {
            isAdmin: true,
        }
        const token = jwt.sign(payload, process.env.KEY, {expiresIn: 900})
        res.send({
            message: "admin_auth_success",
            isAdmin: true,
            token
        })
    }
    else {
        let result = await User.findOne({username, password})
        if (result) {
            const payload = {
                userId: result.userId,
                maxAge: moment().add(15, 'minutes')
            }
            const token = jwt.sign(payload, process.env.KEY, {expiresIn: 900})
            const tickets = await Ticket.find({ userId: result.userId })
            const event = await Show.findOne({showId: tickets.length ? tickets[0].showId : -228})
            const orders = tickets.length ? tickets.map(t => (
                {
                    seatsIds: t.seatsIds,
                    ticketId: t.ticketId,
                    userId: t.userId,
                    showId: t.showId,
                    status: t.status,
                    eventName: event.name
                }
            )) : []

            console.log('auth: ', result)
            res.send({
                message: repository.encrypt("auth_success"),
                isAdmin: false,
                orders,
                token
            })


        }
    else res.sendStatus(401)
    }
})
app.post('/card', async (req, res) => {
    if (await repository.requestVerify(req)) {
        const { cardNumber, cardholderName, expirationDate, cvv } = req.body
        try {
            const token = jwt.verify(req.headers.authorization, process.env.KEY)

            const card = new Card({ userId: token.userId, cardNumber, cardholderName, expirationDate, cvv })
            await card.save()
            res.send({ message: 'Card saved' })
        }
        catch (e) {
            console.error(e)
        }
    }
    else res.sendStatus(401)
})
app.post('/purchase', async (req, res) => {
    if (await repository.requestVerify(req)) {
        const { seatsIds, showId } = req.body
        try{
            const show = await Show.findOne({ showId })
            const tickets = await Ticket.find({})
            await Show.updateOne(show, { availablePlaces: show.availablePlaces - seatsIds.length })
            await Promise.all(seatsIds.map(id => Seats.updateOne({ seatId: id }, { status: true })))
            const ticketParams = {
                ticketId: tickets.length ? tickets.map(t => t.ticketId).sort()[tickets.length - 1] : 0,
                userId: jwt.decode(req.headers.authorization).userId,
                status: true,
                seatsIds,
                showId
            }
            const ticket = new Ticket(ticketParams)
            await ticket.save()
            res.send({ ticket: ticketParams })
        }
        catch (e) {
            console.error(e)
        }
    }
    else res.sendStatus(401)
});
app.post('/event', async (req, res) => {
    if (await repository.requestVerify(req)) {
        const { name, type, date, prices } = req.body
        const shows = await Show.find({})
        let lastId = shows[0] ? shows.map(s => s.showId).sort()[shows.length - 1] : -1
        const handledPrices = prices.split('-')
        console.log('event data: ', {lastId, handledPrices})
        const seats = repository.arrayFiller(type).map(id => ({
            showId: lastId+1, seatId: id, number: id, price: repository.getPriceValue(handledPrices), status: false
        }))
        try {
            await Seats.insertMany(seats)
            const showData = {showId: lastId + 1, type, startDate: date, availablePlaces: seats.length, name}
            const show = new Show(showData)
            await show.save()
            res.send({event: showData})
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'Event creation error', error: e})
        }
    }
    else res.sendStatus(401)
});

app.get('/events', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            let events = await Show.find()
            res.send({events})
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'Events fetch error', error: e})
        }
    }
    else res.sendStatus(401)
})
app.get('/event', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            let seats = await Seats.find({showId: req.query.show_id})
            res.send({ seats })
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'Event fetch error', error: e})
        }
    }
    else res.sendStatus(401)
})
app.get('/card', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            const token = jwt.verify(req.headers.authorization, process.env.KEY)
            let card = await Card.findOne({userId: token.userId} )
            res.send({ card })
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'Cards fetch error', error: e})
        }
    }
    else res.sendStatus(401)
})
app.get('/users', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            let users = await User.find({})

            console.log('fetchUsers: ', users)
            res.send({users})
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'Users fetch error', error: e})
        }
    }
    else res.sendStatus(401)
})
app.get('/user', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            const token = jwt.decode(req.headers.authorization)

            let user = await User.findOne({ userId: token.userId })
            let tickets = await Ticket.find({ userId: token.userId })
            console.log('Tickets: ', tickets)
            const shows = await Promise.all(tickets.map(t => Show.findOne({ showId: t.showId })))
            console.log(shows)
            const ticketsToResponse = tickets.map(t => ({ seatsIds: t.seatsIds, prices: t.prices, eventName: shows.find(e => e.showId === t.showId).name }))
            res.send({ username: user.username, email: user.email, password: user.password, orders: ticketsToResponse, isAdmin: false })
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'User fetch error', error: e})
        }
    }
    else res.sendStatus(401)
})
app.put('/user', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            const token = jwt.verify(req.headers.authorization, process.env.KEY)
            const {email, password, username} = req.body

            const result = await User.updateOne({userId: token.userId}, {email, password, username})
            res.send({db: result})
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'User update error', error: e})
        }
    }
    else res.sendStatus(401)
})

app.delete('/signup', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            const token = jwt.verify(req.headers.authorization, process.env.KEY)

            await User.deleteOne({userId: token.userId})
            res.send({ message: 'Account has been deleted successfully' })
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'Account deleting error', error: e})
        }
    }
    else res.sendStatus(401)
})
app.delete('/canceling', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            const token = jwt.verify(req.headers.authorization, process.env.KEY)

            const seats = []
            const tickets = await Ticket.find({ userId: token.userId })
            await Ticket.deleteMany({ userId: token.userId })
            tickets.forEach(t => {
                seats.push(...t.seatsIds)
            })
            console.log('promise: ', await Promise.all(seats.map(id => Seats.updateOne({ seatId: id }, { status: false }))))
            const shows = await Promise.all(tickets.map(t => Show.findOne({ showId: t.showId })))
            await Promise.all(tickets.map(t =>
                Show.updateOne({ showId: t.showId },
                    { availablePlaces: shows.find(s => s.showId === t.showId).availablePlaces + t.seatsIds.length })))
            res.send({ message: 'Orders have been canceled successfully' })
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'Orders cancel error', error: e})
        }
    }
    else res.sendStatus(401)
});
app.delete('/cards', async (req, res) => {
    if (await repository.requestVerify(req)) {
        try {
            const token = jwt.verify(req.headers.authorization, process.env.KEY)

            await Card.deleteOne({userId: token.userId, cardNumber: req.query.card_number})
            res.send({
                message: `Card removed from user ${token.userId}`,
            })
        }
        catch (e) {
            console.error(e)
            res.send({ message: 'Card deletion error', error: e})
        }
    }
    else res.sendStatus(401)
});
app.delete('/users', async (req, res) => {
    if (await repository.requestVerify(req)) {
        const userId = req.query.user_id

        try {
            await User.deleteOne({userId})
            res.send({
                message: `User deleted ${userId}`,
            })
        }
        catch (e) {
            console.log(e)
            res.send({ message: 'User deletion error', error: e})
        }
    }
    else res.sendStatus(401)
});
app.delete('/events', async (req, res) => {
    if (await repository.requestVerify(req)) {
        const showId = req.query.event_id

        try {
            const show = await Show.findOne({ showId })
            await Show.deleteOne(show)
            res.send({
                message: `Event deleted ${showId}`,
            })
            await Seats.deleteMany({ showId: show.showId })
        }
        catch (e) {
            console.log(e)
            res.send({ message: 'Event deletion error', error: e})
        }
    }
    else res.sendStatus(401)
});



const deleteUser = async (email) => {
    User.findOne({ email }, (err, res) => {
        if (err) console.log(err);
        else {
            User.deleteOne(res, (err) => console.log(err));
        }
    });
}

const port = process.env.port || 8000;
app.listen(port, () => {
    console.log('App is corresponding at port ' + port);
});