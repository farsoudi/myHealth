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
const res = require('express/lib/response');
const { render } = require('express/lib/response');
require('dotenv').config()
const von = require("@vonage/server-sdk");

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
        return(newDate.getMonth()+1);
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





/*
USER BACK END
*/
//Send the login form
app.get("/", (req, res) => {
    res.render("login.ejs");
})



/*
USER BACK END
*/
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
                        if(results[0].id == 1){ //check if the admin is logging in
                            req.session.loggedin = true;
                            req.session.username = id;
                            res.redirect("/admin");
                        }else { //if not admin, then start a normal session
                            req.session.loggedin = true;
                            req.session.username = id;
                            req.session.realname = results[0].name
                            res.redirect("/checksick");
                        }
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




/*
USER BACK END
*/
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





/*
USER BACK END
*/
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
/*
end USER BACK END
*/
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
//
/*
ADMIN BACK END 
*/
//Submitting new Alerts
//Code to give VONAGE API our keys. (STORED IN A .env FILE)
a = [process.env.KEY1, process.env.KEY2];
const vonage = new von({
    apiKey: a[0],
    apiSecret: a[1]
});

//Connecting to API to send a message
function message(number, text){
    vonage.message.sendSms(
        "18334297736",
        `1${number}`,
        text,
        (err, responseData) => {
            if (err) {
                console.log(err);
            } else {
                if (responseData.messages[0]["status"] === "0") {
                    console.dir(responseData);
                } 
            }
        }
    );
}








//Blueprint to convert date JSON from database into a human readable string value. Used for admin panel when viewing user entries and alert logs.
function convDate(d){
    let newDate = "";
    let mins = "";
    if(d.date[3] < 10){
          mins = "0" + d.date[3];
    } else {
        mins = '' + d.date[3];
    }
    if(d.date[2] < 12) {
        newDate =`(${d.date[0]}/${d.date[1]} at ${d.date[2]}:${mins} AM)`
    } else if (d.date[2] == 12){
        newDate =`(${d.date[0]}/${d.date[1]} at ${d.date[2]}:${mins} PM)`
    }else if (d.date[2] > 12) {
        let fixedHour = d.date[2]-12;
        newDate =`(${d.date[0]}/${d.date[1]} at ${fixedHour}:${mins} PM)`
    }
    return(newDate);
}











//when admin is logged in send him the admin panel
app.get("/admin", (req,res) => {
    if (req.session.loggedin && req.session.username == 1){
        res.render("admin");
    }else {
        res.send(errorMsg);
    }
})



var diseaseNames = ["COVID-19", "Cold", "Orthopedic Injury", "Unirary Tract Infection", "Food Poisoning", "Stomach Virus", "Flu", "Bronchitis", "Concussion", "Mono", "Chlamydia", "Pneumonia", "Shingles", "Chicken Pox", "Gonorrhea", "Other"];
//when admin wants to go to the next page from panel, this is called. All 3 buttons are routed through here!
app.post("/admindata", (req, res) => {
    if(req.session.loggedin && req.session.username == 1){
        if(req.body.a){
            var arr = [];
            db.query("SELECT l.id, l.user_id, l.disease, l.date, u.name FROM logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 50", (err, results) => {
                if(err){
                    throw err;
                } else {
                    
                    for (v in results){ //for loop to construct array of entries with each entry stored in a master array. 
                        //temp array that will be added to master array
                        let a = []
                        a.push('' + results[v].id);
                        a.push('' +results[v].user_id);
                        a.push(diseaseNames[results[v].disease-1]);
                        a.push(results[v].name);

                        //convert the stored date into human readable form
                        a.push(convDate(JSON.parse(results[v].date)));
                        arr.push(a); //add this entry to the master array
                    }//end for loop
                } //end of sql query 
                    res.render("entries", {arr: arr}); //send out the new page generated
            })
        }else if (req.body.b){ 
            res.redirect("/getalerts"); //redirect to /getAlerts if they press the recent alerts button and continue from there.
        } else if(req.body.c){ //admin chooses to construct a new alert
            res.render("alert.ejs");
        }
    }else {
        res.send(errorMsg);
    }
})






//This is called from the app.post("/newAlert") method below, this is a seperate function incase we want to do this on serverside without client authentication in the future.
function alert(disease) {
    msg = `[MYHEALTH] CAUTION - HIGH AMOUNT OF REPORTS FOR ${disease} ON SDSU CAMPUS. PLEASE PROCEED WITH CAUTION AND PRACTICE SOCIAL DISTANCING.`;

    //add alert to database
    db.query(`INSERT INTO alerts VALUES(0, "${disease}", '{"date":[${[RightNow.getMonth(), RightNow.getDay(), RightNow.getHour(), RightNow.getMinute()]}]}')`, (err, res2) => {
        if(err){
            throw err;
        }
    });

    //alert everyone in database that has a number
    db.query("SELECT number FROM users WHERE number IS NOT NULL", (err, res) => {
        if(err){
            throw err;
        } else {
            for(v in res){
                message(res[v].number, msg)
            }
        }
    }); //Retrieve all numbers from database and send message to it + put in a new entry in the alerts database.
    return(1);
}
app.post("/newAlert", (req, res) => { //First come here when admin submits new alert, checks if admin is authenticated then proceeds.
    if(req.session.loggedin && req.session.username == 1){
        alert(diseaseNames[req.body.disease-1].toUpperCase());
        res.redirect("/admin");
    } else {
        res.send(errorMsg);
    }
})




app.get("/getalerts", (req, res) => {
    db.query("SELECT * from alerts ORDER BY id DESC LIMIT 50;", (err, results) => {
        if (err) {
            throw err;
        } else {
            for(v in results){
                //console.log(results[v].date);
                results[v].date = convDate(JSON.parse(results[v].date));
            }
            //convert the dates in results


            
            console.log(results[0].disease);
            res.render("alerts", {arr: results});
        }
    })
})







/*
ADMIN BACK END 
*/
















app.listen(3000, () => {
    console.log('listening on port ' + 3000);
  })