// YOU CAN USE THIS FILE AS REFERENCE FOR SERVER DEVELOPMENT

// include the express modules
var express = require("express");
const path = require('path');

// create an express application
var app = express();
const url = require('url');

// helps in extracting the body portion of an incoming request stream
var bodyParser = require('body-parser'); // this has been depricated, is now part of express...

// fs module - provides an API for interacting with the file system
var fs = require("fs");

// helps in managing user sessions
var session = require('express-session');

// include the postgresql module
const { Pool } = require('pg');
const dbConfig = require('./config.js');
const pool = new Pool(dbConfig);

// Bcrypt library for comparing password hashes
const bcrypt = require('bcrypt');
const saltRounds = 10; // For hashing the password


// A possible library to help reading uploaded file.
// var formidable = require('formidable');

// apply the body-parser middleware to all incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// view engine

// use express-session
// in mremory session is sufficient for this assignment
app.use(session({
  secret: "csci4131secretkey",
  saveUninitialized: true,
  resave: false
}
));
// add safety for all api calls, make sure user is logged in
function redirect2Login (requ, resp) {
  if (!(requ.session && requ.session.isLoggedIn)) {
    resp.redirect('/login');
    return true;
  }
  return false;
}

// should be called each time a new receipt is added, user is added to group, user chnages group (temp to sync data)
async function updateUsers_receipts (req, res) {
  let cur_user = req.session.user_id;
  let group = req.session.group_id;
  if (group === -1) {
    return res.sendStatus(409);
  }
  let client = await pool.connect();
  try {
    client.query('BEGIN');
    // get list of users associated woth group
    const res1 = await client.query('SELECT user_id FROM users_groups WHERE group_id = $1', [group]);
    let users = res1.rows;
    // get list of receipts asscoiated with group
    const res2 = await client.query('SELECT receipt_id FROM Receipts WHERE group_id = $1', [group]);
    let receipts = res2.rows
    users.forEach(async (user) => {
      receipts.forEach(async (receipt) => {
        // check to see if it exists
        const match = await client.query('SELECT * FROM Users_Receipts WHERE user_id = $1 AND receipt_id = $2', [user.user_id, receipt.receipt_id]);
      if (match && match.rows.length === 0) {
        // if it doens't exist add new row
        // console.log("Adding user:", user.user_id, "receipt:", receipt.receipt_id);
        await client.query('INSERT INTO Users_Receipts (user_id, receipt_id) VALUES ($1, $2)',
        [user.user_id,receipt.receipt_id]);
        }
      });
    });
    await client.query('COMMIT');
    console.log("updating users_receipts succeeded");
  } catch {
    await client.query('ROLLBACK'); // rollback if any error occurs
    console.log("updating users_receipts fialed");
  } finally {
    if (client)
      client.release();
  }
}
// server listens on port 9007 for incoming connections
app.listen(9007, () => console.log('Listening on port 9007!'));

//handle new users
app.post('/api/accountForm', async (req, res) => {
    
    const { email, name, password } = req.body;
  
    if (!email || !name || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const queryText = 'INSERT INTO Users (email, name, password) VALUES ($1, $2, $3) RETURNING *';
      const values = [email, name, hashedPassword];
  
      const result = await pool.query(queryText, values);
      const newUser = result.rows[0];
  
      res.status(201).json({ success: true, message: 'Account created successfully', user: newUser });
    } catch (error) {
      console.error(error);
      if (error.code === '23505') {
        // Unique violation (duplicate email)
        res.status(400).json({ success: false, message: 'Email already exists' });
      } else {
        res.status(500).json({ success: false, message: 'An error occurred' });
      }
    }
  });


//handle logouts
app.post('/api/logout', (req, res) => {
  if (redirect2Login (req, res)) return;
  // Destroy the session and handle the result
  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err);
      res.status(500).send('Could not log out, server error');
    } else {
      res.status(200).json({ success: true });

    }
  });
});
// function to handle login form post request
app.post('/api/loginForm', async (req, res) => {
      const { username, password } = req.body;
      let email = username; // kinda dumb whatever
      const query = 'SELECT * FROM Users WHERE email = $1';
      const params = [email];
      let client = await pool.connect();
      // TODO: need to query for group_id and set upon login
     try {
        const result = await client.query(query, params);
        const user = result.rows[0];
      
        if (!user) {
          console.log("couldn't find user");
          return res.status(400).json({ success: false, message: "Username does not exist" });
        }
        bcrypt.compare(password, user.password, async (err, isMatch) => {
          if (err) {
            console.error('Encryption error', err);
            return res.status(500).json({ success: false, message: "Encryption error" });
          }
          if (isMatch) {
             // check to see if user has any groups, just asign user a group to start
            const res2 = await client.query('SELECT group_id FROM Users_Groups WHERE user_id = $1', [user.user_id])
            if (res2.rows.length === 0){
              req.session.group_id = -1;
            } else {
              req.session.group_id = res2.rows[0].group_id;
            }
            console.log("group id: " + req.session.group_id);
            // save session id
            req.session.user_id = user.user_id;
            req.session.isLoggedIn = true;
            res.status(200).json({ success: true, data: 'success' });
          } else {
            console.log("incorrect password");
            res.status(401).json({ success: false, data: "username and password don't match" });
          }

        });
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK'); // rollback if any error occurs
        console.error(error);
        res.status(500).json({ success: false, message: 'An error occurred' });
      } finally {
        if (client)
          client.release();
      }
    
});
// Payload is [receiptname (str), totalAmount (float), date (Date), Items = [Item [(name (str), price (float), index(int))],...] (Array) ]
app.post('/api/receiptEntry', async (req, res) => {
  if (redirect2Login (req, res)) return;
  let user = req.session.user_id;
  let group = req.session.group_id;
  let data = req.body;
  if (group === -1) {
    return res.sendStatus(409);
  }
  let client = await pool.connect();
  // console.log(user);
  // enter receipt entry
  // console.log(group);
  try {
    client.query('BEGIN');
    const res1 = await client.query('INSERT INTO Receipts (date, name, total_Amount, created_by, group_id) VALUES ($1, $2, $3, $4, $5) RETURNING receipt_id',
      [data.date, data.receiptName, data.totalAmount, user, group]
    );
    let receipt_id = res1.rows[0].receipt_id;
    data.items.forEach(async (item) => {
      await client.query('INSERT INTO Items (receipt_id, item_name, item_price) VALUES ($1, $2, $3)',
      [receipt_id, item.name, item.price]
    );
    });
    await updateUsers_receipts (req, res); // update associated table
    // // add negative amount for user who created receipt
    // const set_amount = await client.query('UPDATE Users_Receipts SET amount_owed = $1 WHERE user_id = $2 AND receipt_id = $3',
    //  [-data.totalAmount, user, receipt_id]);
    // if (set_amount.rowCount === 0) {
    //   throw new Error('Failed to update amount_owed.');
    // }
    await client.query('COMMIT');
    res.sendStatus(200);
  } catch {
    await client.query('ROLLBACK'); // rollback if any error occurs
    console.log("entering receipt did not work");
    res.sendStatus(500);
  } finally {
    if (client)
      client.release();
  }
});
// {group-name: str, group-code: str}
app.post('/api/createGroup', async (req, res) => {
  if (redirect2Login (req, res)) return;
  let user = req.session.user_id;
  let data = req.body;
  let client = await pool.connect();
  try {
    const res1 = await client.query('SELECT * FROM Groups WHERE group_name = $1 AND group_code = $2', [data.groupName, data.groupCode]);
    //make sure group name and code doesn't already exist
    if (res1.rows.length != 0) {
      return res.sendStatus(409);
    }
    // create group in groups table
    const res2 = await client.query('INSERT INTO Groups (group_name, created_by, group_code) VALUES ($1, $2, $3) RETURNING group_id',
      [data.groupName, user, data.groupCode]
    );
    let group_id = res2.rows[0].group_id;
    // console.log(group_id)
    // add group_id to user-groups table
    const res3 = await client.query('INSERT INTO Users_Groups (user_id, group_id) VALUES ($1, $2)',
      [user, group_id]);
    req.session.group_id = group_id; //set session group_id to be the newly created group
    await client.query('COMMIT');
    updateUsers_receipts(req, res); // update associated tables
    res.sendStatus(200);
  } catch (error) {
    await client.query('ROLLBACK'); // rollback if any error occurs
    console.log("creating group didn't work " + error);
    res.sendStatus(500);
  } finally {
    if (client)
      client.release();
  } 
});
// {group-name: str, group-code: str}
app.post('/api/joinGroup', async (req, res) => {
  if (redirect2Login (req, res)) return;
  let user = req.session.user_id;
  let data = req.body;
  let client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res1 = await client.query('SELECT group_id, group_code FROM Groups WHERE group_name = $1 AND group_code = $2', [data.groupName, data.groupCode]);
    // make sure group name and code already exist
    if (res1.rows.length === 0) {
      return res.sendStatus(409);
    }

    let group_id = res1.rows[0].group_id;
    let group_code = res1.rows[0].group_code;
    // make sure user isn't already apart of the group
    const res2 = await client.query('SELECT * FROM Users_Groups WHERE group_id = $1 AND user_id = $2', [group_id, user]);
    if (res2.rows.length != 0) {
      return res.sendStatus(409);
    }
    // create row in users-groups table
    const res3 = await client.query('INSERT INTO Users_Groups (user_id, group_id) VALUES ($1, $2)',
      [user, group_id]
    );
    // console.log(group_id)
    // add group_id to user-groups tap
    req.session.group_id = group_id; //set session group_id to be the newly joined group
    await client.query('COMMIT');
    updateUsers_receipts(req, res); // update associated tables
    res.sendStatus(200);
  } catch (error) {
    await client.query('ROLLBACK'); // rollback if any error occurs
    console.log("joining group didn't work " + error);
    res.sendStatus(500);
  } finally {
    if (client)
      client.release();
  }

});

// api for changing current group user is asscoiated with
app.post('/api/changeGroup', async (req, res) => {
  if (redirect2Login (req, res)) return;
  let {group_id} = req.body;
  req.session.group_id = group_id;
  // updateUsers_receipts(req, res);
  res.sendStatus(200);
});
app.post('/api/assignItemsToUser', async (req, res) => {
  if (redirect2Login (req, res)) return;
  let {user_id, selected_Items, deselected_Items} = req.body;
  let client;
  // console.log(user_id, selected_Items, deselected_Items);
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    selected_Items.forEach(async item_id => {
      // check to see if it exists
      const res1 = await client.query('SELECT * FROM Items_Users WHERE user_id = $1 AND item_id = $2', [user_id, item_id]);
      if (res1.rows.length == 0) {
        // if not add row
        const res2 = await client.query('INSERT INTO Items_Users (item_id, user_id) VALUES ($1, $2)', [item_id, user_id]);
        console.log("items_users table updated")
      }
    });
    deselected_Items.forEach(async item_id => {
      // check to see if it exits
      const res2 = await client.query('SELECT * FROM Items_Users WHERE user_id = $1 AND item_id = $2', [user_id, item_id]);
      if (res2.rows.length != 0) {
        // if it does delete row
        const res2 = await client.query('DELETE FROM Items_Users WHERE user_id = $1 AND item_id = $2', [user_id, item_id]);
      }
    });
    await client.query('COMMIT');
    res.sendStatus(200);
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback if any error occurs
    console.log("joining group didn't work " + error);
    res.sendStatus(500);
  } finally {
    if (client)
      client.release();
  }
});
// populate Receipts page
app.get('/api/populateReceipts', async function(req, res) {
  if (redirect2Login (req, res)) return;
  let user = req.session.user_id;
  let group = req.session.group_id;
  let receipt_list = new Array()
  let client;
  res.setHeader('Content-Type', 'application/json');
  try {
    client = await pool.connect();
    const res1 = await client.query('SELECT group_name FROM Groups WHERE group_id = $1', [group]);
    let group_name = res1.rows[0].group_name;
    // get receipt info used group as key
    const receipt_ids = await client.query('SELECT receipt_id, name FROM RECEIPTS WHERE group_id = $1', [group]);
    receipt_ids.rows.forEach(async (id) => {
      // use receipt key to get list of items
      const res3 = await client.query('SELECT * FROM Items WHERE receipt_id = $1', [id.receipt_id]);
      receipt_list.push({'id': id.receipt_id, 'receipt': id.name, 'items': res3.rows});
    });
    await client.query('COMMIT');
    data = {'receipt_list': receipt_list, 'group_name': group_name};
    // console.log(data);
    res.status(200).json(data);
  } catch (error) {
    await client.query('ROLLBACK');
    res.sendStatus(500);
    console.log(error);
  } finally {
    if (client)
      client.release();
  }

});
app.get('/api/populateGroups', async function(req, res) {
  if (redirect2Login (req, res)) return;
  let user = req.session.user_id;
  let group_list = new Array();
  let client;
  res.setHeader('Content-Type', 'application/json');
  try {
    client = await pool.connect();
    const group_ids = await client.query('SELECT group_id FROM Users_Groups WHERE user_id = $1', [user]);
    // console.log(group_ids.rows);
    group_ids.rows.forEach(async (id) => {
      console.log(id);
      const group_name = await client.query('SELECT group_name FROM Groups WHERE group_id = $1', [id.group_id]);
      group_list.push({'group_id': id.group_id, 'group_name': group_name.rows[0].group_name});
    });
    await client.query('COMMIT');
    
    let data = {'data': group_list, 'current': req.session.group_id};
    // console.log(data);
    res.send(JSON.stringify(data));
  } catch (error) {
    await client.query('ROLLBACK'); // rollback if any error occurs
    res.status(500).send('An error occurred');
  } finally {
    if (client)
      client.release();
  }
}); 
// get users for the view Receipts page
app.get('/api/getUsers', async function(req, res) {
  if (redirect2Login (req, res)) return;
  let user_list = new Array();
  res.setHeader('Content-Type', 'application/json');
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const users = await client.query('SELECT user_id FROM Users_Groups WHERE group_id = $1', [req.session.group_id]);
    users.rows.forEach(async (id) => {
      const name = await client.query('SELECT name FROM Users WHERE user_id = $1', [id.user_id]);
      user_list.push({'id': id.user_id, 'name': name.rows[0].name});
    });
    await client.query('COMMIT');
    let data = {'data': user_list};
    // console.log(data);
    res.status(200).json(data);
  } catch (error) {
    await client.query('ROLLBACK'); // rollback if any error occurs
    res.status(500).send('An error occurred');
  } finally {
    if (client)
      client.release();
  }
});
// gets the assigned items for that user for the view receipts page 
app.get('/api/getAssignedItems', async function(req, res) {
  if (redirect2Login (req, res)) return;
  const { userId } = req.query;
  let client;
  // console.log(userId);
  let item_ids = [];
  res.setHeader('Content-Type', 'application/json');
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const res1 = await client.query('SELECT item_id FROM Items_Users WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    res1.rows.forEach( (item) => {
      item_ids.push(item.item_id);
    });
    res.status(200).json({assignedItems: item_ids});
    // console.log(res1.rows);
  } catch (error) {
    console.log("Fetching items didn't work");
    await client.query('ROLLBACK'); // rollback if any error occurs  
    res.sendStatus(500);
  } finally {
    if (client)
    client.release();
  }
});

// Most import function, uses the datatbase to provide valuable data for the user
app.get('/api/homeStats', async function(req, res) {
  if (redirect2Login (req, res)) return;
  let user = req.session.user_id;
  let group = req.session.group_id;
  let client;
  // console.log(userId);
  res.setHeader('Content-Type', 'application/json');
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // first update split costs
    // get all items associted with current user
    const res1 = await client.query('SELECT item_id FROM Items_Users WHERE user_id = $1', [user]);
    res1.rows.forEach( async (item) => {
      // get number of users associated with each item the user claims
      const res2 = await client.query('SELECT user_id FROM Items_Users WHERE item_id = $1', [item.item_id]);
      // update portion based off 1 / (# users who claim item)
      let portion = parseFloat((1 / res2.rows.length).toFixed(2)); // allow 2 decimal places
      const res3 = await client.query('UPDATE Items_Users SET portion = $1 WHERE item_id = $2 AND user_id = $3',
      [portion, item.item_id, user]
      );
      // console.log(res3.rows);
    });
    // selected current group
    if (group != null) {
      const res4 = await client.query(
        'SELECT * FROM Receipts WHERE group_id = $1',
        [group]
      );
      let receipts = res4.rows;
      let total_expense = 0;
      let total_spent = 0;
      for (let receipt of receipts) {
        let createdByCurrentUser = (user === receipt.created_by);
        // Calculate total spent
        let receipt_spent = 0;
        if (createdByCurrentUser) {
          receipt_spent = parseFloat(receipt.total_amount);
          total_spent += receipt_spent;
        } 
        // console.log(total_spent);
        // Calculate total expense
        const res5 = await client.query(
          'SELECT SUM(IU.portion * I.item_price) as total_expense ' +
          'FROM Items_Users IU ' +
          'JOIN Items I ON IU.item_id = I.item_id ' +
          'JOIN Receipts R ON I.receipt_id = R.receipt_id ' +
          'WHERE IU.user_id = $1 AND R.group_id = $2',
        [user, group]
        );
        let receipt_expense = parseFloat(res5.rows[0].total_expense) || 0;
        total_expense += receipt_expense;
        await client.query("UPDATE Users_Receipts SET amount_owed = $1 WHERE user_id = $2 AND receipt_id = $3",
        [receipt_expense - receipt_spent, user, receipt.receipt_id]);
      }
      let total_owed = total_expense - total_spent;
      const gName = await client.query('SELECT group_name FROM Groups WHERE group_id = $1', [group]);
      await client.query('COMMIT');
      res.status(200).json({
        total_expense: parseFloat(total_expense.toFixed(2)),
        total_spent: parseFloat(total_spent.toFixed(2)),
        total_owed: parseFloat(total_owed.toFixed(2)),
        group_name: gName.rows[0].group_name
      });
    } else {
      throw new Error("User not in any groups");
    }
  } catch (error) {
    console.log("Fetching items didn't work: " + error);
    await client.query('ROLLBACK'); // rollback if any error occurs  
    res.sendStatus(500);
  } finally {
    if (client)
    client.release();
  }
});


// all the static file functions
app.get('/',function(req, res) {
    res.sendFile(path.join(__dirname, 'static', 'welcome.html'));
});

app.get('/createAccount', function(req, res) {
    if (req.session && req.session.isLoggedIn) {
      res.redirect('/home');
    } else {
      res.sendFile(path.join(__dirname, 'static', 'createAccount.html'));
    }
  });
app.get('/login', function(req, res) {
  if (req.session && req.session.isLoggedIn) {
    res.redirect('/home');
  } else {
    res.sendFile(path.join(__dirname, 'static', 'login.html'));
  }
});
app.get('/home', function(req, res) {
  if (req.session && req.session.isLoggedIn) {
    res.sendFile(path.join(__dirname, 'static', 'home.html'));
  } else {
    res.redirect('/login');
  }
});
app.get('/addReceipt', function(req, res) {
  if (req.session && req.session.isLoggedIn) {
    res.sendFile(path.join(__dirname, 'static', 'addReceipt.html'));
  } else {
    res.redirect('/login');
  }
});
app.get('/manageGroups', function(req, res) {
  if (req.session && req.session.isLoggedIn) {
    res.sendFile(path.join(__dirname, 'static', 'manageGroups.html'));
  } else {
    res.redirect('/login');
  }
});
app.get('/addReceipt', function(req, res) {
  if (req.session && req.session.isLoggedIn) {
    res.sendFile(path.join(__dirname, 'static', 'addReceipt.html'));
  } else {
    res.redirect('/login');
  }
});
app.get('/viewReceipts', function(req, res) {
  if (redirect2Login (req, res)) return;
  res.sendFile(path.join(__dirname, 'static', 'viewReceipts.html'));
});
// middle ware to serve static files
app.get('/static/*', function(req, res) {
  if (redirect2Login (req, res)) return;
  res.sendFile(path.join(__dirname, 'static', 'addReceipt.html'));
});

// function to return the 404 message and error to client
app.get('*', function(req, res) {
  // add details
  res.sendStatus(404);
});
