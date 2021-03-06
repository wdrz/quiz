import * as sqlite from 'sqlite3';
import {Quiz, Question, AnswerToOne, Result } from './definitions';

export class QuizList {

  #db: sqlite.Database;

  constructor(db: sqlite.Database) {
    this.#db = db;
  }


  async query_db(phrase: string, replace: any[]): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.#db.all(phrase, replace, (err, rows) => {
        if (err) {
          console.log(err);
          reject('DB Error: ' + err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async insert_db(phrase: string, replace: any[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.#db.run(phrase, replace, (err) => {
        if (err) {
          console.log(err);
          reject('DB Error: ' + err);
        } else {
          resolve();
        }
      });
    });
  }

  async add_question(quest : Question, quizId: number) : Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.#db.run("INSERT INTO questions (id, text, answer, penalty, quiz_id) VALUES (?, ?, ?, ?, ?);",
        [quest.id || null, quest.text, quest.answer, quest.penalty, quizId], (err) => {
          if (err) {
            console.log(err);
            reject('DB Error: question could not be added');
          } else {
            console.log('Added question ' + quest.text);
            resolve();
          }
      });
    });
  }

  async add_quiz(quiz : Quiz) : Promise<void> {
    console.log("adding quiz...")
    return new Promise<void>((resolve, reject) => {
      this.#db.run("INSERT INTO quizes (id, title, intro) VALUES (?, ?, ?);",
        [quiz.id || null, quiz.title, quiz.intro], (err) => {
          if (err) {
            console.log(err);
            reject('DB Error: quiz could not be added. ' + err);
          } else {
            console.log('DB: Added quiz ' + quiz.title);
            resolve();
          }
      });
    });
  }

  async add_quizes(quizes : Quiz[]) : Promise<void> {
      for (const quiz of quizes) {
        await this.insert_db("BEGIN TRANSACTION", []);

        await this.add_quiz(quiz);
        if (!quiz.id) quiz.id = (await this.query_db(`SELECT id FROM quizes WHERE title = ?;`, [quiz.title]))[0].id;

        for (const quest of quiz.content) {
          await this.add_question(quest, quiz.id);
        }
        await this.insert_db("END TRANSACTION", []);
      }
  }

  async get_quizes(userId: number): Promise<Quiz[]> {
    return this.query_db(`
    SELECT quizes.id, intro, title, results.points AS points
    FROM quizes
    LEFT JOIN results
    ON quizes.id=results.quiz_id
    AND results.user_id=?;`, [userId]);
  }

  async getQuizById(quizId: number) : Promise<Quiz> {
    return new Promise<Quiz> ((resolve, reject) => {
      this.#db.all(`
        SELECT * FROM quizes WHERE id = ?;`, [quizId], (err, rows) => {
          if (err) {
            console.log(err);
            reject('DB Error while getting a quiz by id.');
          } else if (rows.length === 0) {
            reject('No such quiz');
          } else {
            resolve(rows[0]);
          }
        });
    });
  }

  async getQuestionsByQuizId(quizId: number, answers: boolean) : Promise<Question[]> {
    return new Promise<Question[]> ((resolve, reject) => {
      this.#db.all(`
        SELECT id, text, penalty ${answers ? ", answer " : ""}
        FROM questions
        WHERE quiz_id = ?
        ORDER BY id ASC;`, [quizId], (err, rows) => {
          if (err) {
            console.log(err);
            reject('DB Error while getting questions for a quiz.');
          } else {
            resolve(rows);
          }
        });
    });
  }

  async getResult(quizId: number, userId: number): Promise<Result> {
    return new Promise<Result> ((resolve, reject) => {
      this.#db.all(`
        SELECT *
        FROM results
        WHERE user_id = ?
        AND quiz_id = ?;
        `, [userId, quizId], (err, rows) => {
          if (err) {
            console.log(err);
            reject('DB Error getResult.');
          } else if (rows.length === 0) {
            reject();
          } else {
            resolve(rows[0]);
          }
        });
    });
  }

  async canBeAccessed(quizId: number, userId: number): Promise<void> {
    return new Promise<void> ((resolve, reject) => {
      this.getQuizById(quizId).then(() =>
        this.getResult(quizId, userId).then(reject).catch(resolve)
      ).catch(reject);
    });
  }


  async add_result(res: Result, stats: AnswerToOne[]): Promise<void> {
    console.log('inserting a result ... ');
    return new Promise<void>(async (resolve, reject) => {
      await this.insert_db("BEGIN TRANSACTION", []);
      this.#db.run(`
        INSERT INTO results (id, quiz_id, user_id, points)
        VALUES (?, ?, ?, ?);`,
        [res.id, res.quiz_id, res.user_id, res.points], (err) => {
          if (err) {
            console.log(err);
            this.#db.run(`ROLLBACK`);
            reject('DB Error: result could not be added. ' + err);
          } else {
            for (const ans of stats) {
              this.insert_db(`
                INSERT INTO answers (result_id, question_id, quiz_id, timeSpent, answer, ok)
                VALUES (?, ?, ?, ?, ?, ?);`, [res.id, ans.questionId, res.quiz_id, ans.timeSpent, ans.answer, ans.ok]
              ).catch((err2) => {
                console.log(err2);
                reject('DB Error: result could not be added. ' + err);
                this.#db.run(`ROLLBACK`);
                return;
              });
            }
            this.#db.run(`END TRANSACTION`);
            console.log('DB: Added result');
            resolve();
          }
      });
    });
  }


  async submit_result(stats: AnswerToOne[], userId: number, quizId: number, serverMiliseconds: number): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      const quests: Question[] = await this.getQuestionsByQuizId(quizId, true);
      if (stats.length !== quests.length) {
        console.log("wrong length of answer array");
        reject();
        return;
      }

      let points: number = Math.floor(serverMiliseconds / 1000);

      stats.forEach((stat, i) => {
        if (stat.questionId !== quests[i].id) {
          console.log("wrong id of a question");
          reject();
        }
        if (stat.answer === quests[i].answer) {
          stat.ok = 1;
        } else {
          stat.ok = 0;
          stat.correctAnswer = quests[i].answer;
          points += quests[i].penalty;
        }
        stat.timeSpent = Math.round(stat.timeSpent * serverMiliseconds / 100);
      });

      const res: Result = {
        id: `${userId}&&&${quizId}`,
        quiz_id: quizId, user_id: userId, points
      };
      this.add_result(res, stats).then(() => resolve()).catch(() => reject());
    });
  }

  async getBestResultsToQuiz(quizId: number): Promise<Result[]> {
    return this.query_db(`
      SELECT users.username, results.points
      FROM results
      LEFT JOIN users
      ON results.user_id = users.id
      WHERE quiz_id = ?
      ORDER BY points ASC
      LIMIT 5;`, [quizId]);
  }

  async getAnswersByResultId(resultId: string): Promise<Result[]> {
    return this.query_db(`
      SELECT *
      FROM answers
      WHERE result_id = ?
      ORDER BY question_id ASC;`, [resultId]);
  }

  async getAveragesByQuizId(quizId: number): Promise<{avg_time: number}[]> {
    return this.query_db(`
      SELECT *
      FROM questions
      LEFT JOIN (
        SELECT question_id, avg(timeSpent) avg_time
        FROM answers
        WHERE quiz_id = ?
        AND ok = 1
        GROUP BY question_id
      ) AS avgs
      ON questions.id = avgs.question_id
      WHERE questions.quiz_id = ?
      ORDER BY id ASC;`, [quizId, quizId]);
  }

  async get_all_quiz_ids(): Promise<Quiz[]> {
    return this.query_db(`
    SELECT *
    FROM quizes;`, []);
  }
}