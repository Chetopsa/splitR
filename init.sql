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