import * as sqlite from 'sqlite3';
import crypto from 'crypto-js';
import {Quiz, Question} from './definitions';
import {QuizList} from './quizList';

const quizData : Quiz[] = [
  {
    "id" : 1,
    "title": "Very important quiz",
    "intro": "This is truly the most difficult quiz of all",
    "content": [
        {"text" : "How many degrees has an over-educated circle?", "answer" : 360, "penalty" : 1000},
        {"text" : "Why was six afraid of seven?", "answer" : 789, "penalty" : 1000},
        {"text" : "At how many degrees you should put a cake in the oven?", "answer" : 0, "penalty" : 1000}
    ]
  },
  {
    "id" : 2,
    "title": "Addition",
    "intro": "This is an easy quiz: add numbers as fast as you can!",
    "content": [
      {"text" : "2 + 2 = ?", "answer" : 4, "penalty" : 5},
      {"text" : "4 + 3 = ?", "answer" : 7, "penalty" : 10},
      {"text" : "5 + 1 = ?", "answer" : 6, "penalty" : 2}
    ]
  },
  {
    "id" : 3,
    "title": "Subtraction",
    "intro": "Can you solve this?",
    "content": [
      {"text" : "3 - 3 = ?", "answer" : 0, "penalty" : 1},
      {"text" : "14 - 1 = ?", "answer" : 13, "penalty" : 10},
      {"text" : "20 - 9 = ?", "answer" : 11, "penalty" : 2},
      {"text" : "3 - 2 = ?", "answer" : 1, "penalty" : 1},
      {"text" : "14 - 1 = ?", "answer" : 13, "penalty" : 10},
      {"text" : "20 - 9 = ?", "answer" : 11, "penalty" : 2}
    ]
  },
  {
    "id" : 4,
    "title": "Multiplication I",
    "intro": "You need to answer all questions!",
    "content": [
      {"text" : "3 ⋅ 3 = ?", "answer" : 9, "penalty" : 1},
      {"text" : "14 ⋅ 1 = ?", "answer" : 14, "penalty" : 10},
      {"text" : "20 ⋅ 9 = ?", "answer" : 180, "penalty" : 5},
      {"text" : "1 ⋅ 9 = ?", "answer" : 9, "penalty" : 10}
    ]
  },
  {
    "id" : 5,
    "title": "Multiplication II",
    "intro": "Second multiplication quiz.",
    "content": [
      {"text" : "3 ⋅ 3 = ?", "answer" : 9, "penalty" : 1},
      {"text" : "14 ⋅ 1 = ?", "answer" : 14, "penalty" : 10},
      {"text" : "20 ⋅ 9 = ?", "answer" : 180, "penalty" : 5},
      {"text" : "1 ⋅ 9 = ?", "answer" : 9, "penalty" : 10}
    ]
  },
  {
    "id" : 6,
    "title": "Multiplication III",
    "intro": "Third multiplication quiz!",
    "content": [
      {"text" : "1 ⋅ 3 = ?", "answer" : 3, "penalty" : 1},
      {"text" : "14 ⋅ 1 = ?", "answer" : 14, "penalty" : 10},
      {"text" : "20 ⋅ 9 = ?", "answer" : 180, "penalty" : 5},
      {"text" : "1 ⋅ 9 = ?", "answer" : 9, "penalty" : 10}
    ]
  },
  {
    "id" : 7,
    "title": "Large numbers",
    "intro": "Add them up!",
    "content": [
      {"text" : "234 + 123", "answer" : 357, "penalty" : 5},
      {"text" : "9900 + 10", "answer" : 9910, "penalty" : 5}
    ]
  }
]

async function create_user(name: string, password: string, db: sqlite.Database) : Promise<void> {
  console.log(`Adding user ${name}/${password} ...`);
  return new Promise<void>((resolve, reject) => {
    db.run(`
      INSERT INTO users (username, password)
      VALUES (?, ?);`,
      [name, crypto.SHA256(password).toString(crypto.enc.Base64)], (err) => {
        if (err) {
          console.log(err);
          reject('DB Error.');
        } else {
          console.log('Done.');
          resolve();
        }
    });
  });
}


async function create_table_users(db: sqlite.Database) : Promise<void> {
  return new Promise<void>((resolve, reject) => {
    db.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      password TEXT);`, (err) => {
        if (err) {
          reject('DB Error');
        } else {
          resolve();
        }
    });
  });
}

async function create_users(db: sqlite.Database) : Promise<void> {
  await create_table_users(db);
  await create_user("user1", "user1", db);
  await create_user("user2", "user2", db);
}

async function create_table_quizes(db: sqlite.Database) : Promise<void> {
  return new Promise<void>((resolve, reject) => {
    db.run(`CREATE TABLE quizes (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL UNIQUE,
      intro TEXT NOT NULL);`, (err) => {
        if (err) {
          reject('DB Error wile creating table quizes');
        } else {
          console.log("Table quizes created.");
          resolve();
        }
    });
  });
}

async function create_table_questions(db: sqlite.Database) : Promise<void> {
  return new Promise<void>((resolve, reject) => {
    db.run(`CREATE TABLE questions (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL,
      answer INTEGER NOT NULL,
      penalty INTEGER NOT NULL,
      quiz_id INTEGER NOT NULL,
      FOREIGN KEY(quiz_id) REFERENCES quizes(id));`, (err) => {
        if (err) {
          reject('DB Error while creating table questions');
        } else {
          console.log("Table questions created.");
          resolve();
        }
    });
  });
}

async function create_table_results(db: sqlite.Database) : Promise<void> {
  return new Promise<void>((resolve, reject) => {
    db.run(`CREATE TABLE results (
      id TEXT PRIMARY KEY,
      quiz_id INTEGER,
      user_id INTEGER,
      points INTEGER,
      FOREIGN KEY(quiz_id) REFERENCES quizes(id),
      FOREIGN KEY(user_id) REFERENCES users(id));`, (err) => {
        if (err) {
          console.log(err);
          reject('DB Error while creating table results');
        } else {
          console.log("Table results created.");
          resolve();
        }
    });
  });
}


async function create_table_answers(db: sqlite.Database) : Promise<void> {
  return new Promise<void>((resolve, reject) => {
    db.run(`CREATE TABLE answers (
      id INTEGER PRIMARY KEY,
      result_id TEXT,
      question_id INTEGER,
      quiz_id INTEGER,
      timeSpent INTEGER,
      answer INTEGER,
      ok INTEGER,
      FOREIGN KEY(result_id) REFERENCES results(id),
      FOREIGN KEY(question_id) REFERENCES questions(id),
      FOREIGN KEY(quiz_id) REFERENCES quiz(id));`, (err) => {
        if (err) {
          console.log(err);
          reject('DB Error while creating table answers');
        } else {
          console.log("Table answers created.");
          resolve();
        }
    });
  });
}

async function createDB() : Promise<void> {
  const db : sqlite.Database = new sqlite.Database('dataStorage.db');
  await create_users(db);
  await create_table_quizes(db);
  await create_table_questions(db);
  await create_table_results(db);
  await create_table_answers(db);
  const ql : QuizList = new QuizList(db);
  ql.add_quizes(quizData);

}

createDB();