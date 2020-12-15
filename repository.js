const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const dbAccess = require('./DBAccess')

const {User} = dbAccess.User
const algorithm = 'aes-256-ctr';
const password = Buffer.alloc(32);
const iv = Buffer.alloc(16)

exports.requestVerify = async (req) => {
    try {
        //console.log('Token decoded: ', jwt.decode(req.headers.authorization))
        console.log('header: ', req.headers.authorization)
        const token = jwt.verify(req.headers.authorization, process.env.KEY)
        let dbSearch = await dbAccess.User.findOne({userId: token.userId})
        console.log('db: ', dbSearch)
        return (!!dbSearch || token.isAdmin);
    } catch (e) {
        console.error(e)
        return false
    }
}

exports.arrayFiller = (type) => {
    const arr = []
    if (type === 'first') {
        for (let i = 1; i <= 24; i++) {
            arr.push(i)
        }
    } else {
        for (let i = 1; i <= 36; i++) {
            arr.push(i)
        }
    }
    return arr
}

exports.getPriceValue = (prices) => {
    let [min, max] = prices
    min = Math.ceil(+min);
    max = Math.floor(+max);
    return Math.floor(Math.random() * (max - min)) + min;
}

exports.encrypt = (secret) => {
        const cipher = crypto.createCipheriv(algorithm, password, iv);
        let encrypted = cipher.update(secret, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
}

exports.decrypt = (secret) => {
    const cipher = crypto.createDecipheriv(algorithm, password, iv)
    let decrypted = cipher.update(secret);
    decrypted += cipher.final('utf8')
    return decrypted
}