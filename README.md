# My Express Project (splitr)

This project is built using Node.js and Express. Basic website for splitting bills easily

## Installation

To run this project, you need to have Node.js and Postgresql installed on your system. Clone this repository and install dependencies:

## Instructions if Noah wants to contribute
<ul>
    <li> clone repo </li>
    <li> create and go to new branch </li>
    <li> make edits on your branch </li>
    <li> add, commit, push changed to yor branch on github </li>
    <li> make pull request to merge changes to main </li>
    <li> and if your local main isn't up to date do: git pull on your main branch </li>
</ul>

```
git clone https://github.com/Chetopsa/splitR.git     // clone repo
git checkout -b any-name                             // now you are on new branch so make changes
git add -A                                           // adds all your new changes
git commit -m "commit message"                       // commit changes
git push -u origin any-name                          // pushes changes to github, now on githib make pull request
```
### Host URL: not hosted rn

## gettign environment setup (prob use vscode)
```bash
cd your-repository-name
git clone https://github.com/chetopsa/splitR
honestly chat gpt how to install node js and postgresql
then look at packahe.json to install dependencies with npm install thing --save
```
## SQL Schema 
```
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE
);

CREATE TABLE Groups (
    group_id SERIAL PRIMARY KEY,
    group_name VARCHAR(100),
    group_code VARCHAR(100),
    created_by INT,
    FOREIGN KEY (created_by) REFERENCES Users(user_id)
);

CREATE TABLE Users_Groups (
    user_group_id SERIAL PRIMARY KEY,
    user_id INT,
    group_id INT,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (group_id) REFERENCES Groups(group_id)
);

CREATE TABLE Receipts (
    receipt_id SERIAL PRIMARY KEY,
    receipt_name VARCHAR(100),
    date DATE,
    total_amount DECIMAL(10, 2),
    created_by INT,
    group_id INT,
    FOREIGN KEY (created_by) REFERENCES Users(user_id),
    FOREIGN KEY (group_id) REFERENCES Groups(group_id)
);

CREATE TABLE Items (
    item_id SERIAL PRIMARY KEY,
    receipt_id INT,
    item_name VARCHAR(100),
    item_price DECIMAL(10, 2),
    FOREIGN KEY (receipt_id) REFERENCES Receipts(receipt_id)
);

CREATE TABLE Users_Receipts (
    user_receipt_id SERIAL PRIMARY KEY,
    user_id INT,
    receipt_id INT,
    amount_owed DECIMAL(10, 2),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (receipt_id) REFERENCES Receipts(receipt_id)
);

CREATE TABLE Items_Users (
    item_user_id SERIAL PRIMARY KEY,
    item_id INT,
    user_id INT,
    portion DECIMAL(3, 2),
    FOREIGN KEY (item_id) REFERENCES Items(item_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
```
