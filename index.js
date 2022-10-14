const express = require('express');
const bodyParser = require("body-parser");
const ejs = require('ejs');
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
const mysql = require('mysql');
var md5 = require('md5'); //for password encryption
const session = require('express-session');
const { request } = require('express');
//mysql connection
const db = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "password",
    database: "myhealth"
  });
  db.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
  });

  //tell express that we are going to use cookie sessions for when user logs in
  app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));
const errorMsg = "<h1>Bad entry, please try again!</h1>";





//Class for storing methods for acquiring the date when a new entry is made.
class RightNow {
    //Return the month
    static getMonth(){
        let newDate = new Date();
        return(newDate.getMonth());
    }

    //Return the day
    static getDay(){
        let newDate = new Date();
        return(newDate.getDate());
    }

    //Return the hour
    static getHour(){
        let newDate = new Date();
        return(newDate.getHours());
    }

    //Return the minute
    static getMinute(){
        let newDate = new Date();
        return(newDate.getMinutes());
    }
}




//Send the login form
app.get("/", (req, res) => {
    res.render("login.ejs");
})




//Every time someone logs in, this is called to authenticate them.
app.post("/auth", (req, res) => {
    let id = req.body.id;
    let password = md5(req.body.password); //hash the given password so it is in align with our database
    if(id && password){ //If both values exist
        db.query('SELECT * FROM users WHERE id = ? AND password = ?', [id, password], (error, results) => {
            if(error){
                throw error;
            }else {
                if(results.length > 0) { //if the database returns us something, that means that combination of password and id exists.
                        req.session.loggedin = true;
                        req.session.username = id;
                        req.session.realname = results[0].name
                        res.redirect("/checksick");
                } else{
                    res.send(errorMsg);
                }
                res.end();
            }
        });
    } else {
        res.send("<h1>Bad entry, please try again!</h1>");
        res.end()
    }
})





//After the user gets authenticated, they get redirected here so that they can recieve the next page.
app.get("/checksick", (req, res) => {
    if(req.session.loggedin){
        db.query("SELECT name FROM users WHERE id=?", req.session.username, (error, results) => {
            res.render("check", {username: results[0].name}); //Send the next page with the username of their account in it (retrieved from SQL database)
        });

    }else {
        res.send(errorMsg); //prompt the user to log in if they havent
    }
})
//Once the user submits if he is sick or not, we arrive here and we route the user based on their input. If they are sick then they get sent to the next page to evaluate.
app.post("/checksick", (req, res) => {
    if(req.session.loggedin){
        if(req.body.yesButton){
            res.redirect("/newsickness"); //Redirect them to the next page if they are sick
        }else if(req.body.noButton){
            let username = req.session.realname;
            res.render("thanks", {endMessage: `Thank you, ${username}, we are glad to know you are doing okay!`})

        }
    } else {
        res.send(errorMsg);
    }
})






//This is where sick people are redirected to; they get sent a page where they can choose their sickness.
app.get("/newsickness", (req, res) => {
    if(req.session.loggedin){
        res.render("disease");
    } else {
        res.send(errorMsg);
    }
})
//This is the function that is called when the user submits what sickness they have.
app.post("/newsickness", (req, res) => {
    if(req.session.loggedin){
        db.query(`INSERT INTO logs VALUES(0, ${req.session.username}, ${req.body.disease}, '{"date":[${[RightNow.getMonth(), RightNow.getDay(), RightNow.getHour(), RightNow.getMinute()]}]}')`, (err, result) => { //Query to database to insert user + sickness they have, and record the date it was submitted.
            if(err){
                throw err;
            } else {
                let username = req.session.realname;
                res.render("thanks", {endMessage: `Thank you, ${username}, we hope you get better soon!`})
            }
        });

    }else {
        res.send(errorMsg);
    }
})

















app.listen(3000, () => {
    console.log('listening on port ' + 3000);
  })