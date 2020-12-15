const mongoose = require('mongoose')

const SeatsSchema = new mongoose.Schema({
    seatId: Number,
    showId: Number,
    price: Number,
    number: Number,
    status: Boolean
})

const ticketsSchema = new mongoose.Schema({
    ticketId: Number,
    userId: Number,
    status: Boolean,
    seatsIds: Array,
    showId: Number
})

const usersSchema = new mongoose.Schema({
    userId: Number,
    username: String,
    password: String,
    email: String
})

const cardsSchema = new mongoose.Schema({
        userId: Number,
        cardNumber: Number,
        cardholderName: String,
        expirationDate: Date,
        cvv: Number
})

const showsSchema = new mongoose.Schema({
    showId: Number,
    type: String,
    name: String,
    startDate: Date,
    availablePlaces: Number,
    prices: String
})

const User = mongoose.model('Users', usersSchema)
const Show = mongoose.model('Shows', showsSchema)
const Card = mongoose.model('Cards', cardsSchema)
const Seats = mongoose.model('Seats', SeatsSchema)
const Ticket = mongoose.model('Tickets', ticketsSchema)

module.exports = {
    User, Show,
    Card, Seats,
    Ticket
}