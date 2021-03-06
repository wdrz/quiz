import { WebDriver, Builder } from 'selenium-webdriver';
import { expect } from 'chai';
import { driver } from 'mocha-webdriver';

const mainPath = 'http://localhost:3000/';
const changePath = 'http://localhost:3000/change'

type client = {
  login: string,
  password: string,
  sid?: any
}

async function log_in({login, password}: {login: string, password: string}) {
  await driver.find('#username').doClear().doSendKeys(login);
  await driver.find('#password').doClear().doSendKeys(password);
  await driver.find('input[type=submit]').doClick();
}

async function logout() {
  await driver.findContent('a', /logout/).doClick();
}

async function assert_logged_in() {
  expect(await driver.find("#instructions").getText()).to.contain("Select a quiz you wish to solve");
}

async function assert_logged_in_as_user(login: string) {
  await assert_logged_in();
  expect(await driver.find("#user").getText()).to.contain(login);
}

async function assert_logged_out() {
  expect(await driver.find("[type='submit']").value()).to.contain("Login");
}

async function change_password({oldpassword, newpassword}: {oldpassword: string, newpassword: string}) {
  await driver.get(changePath);
  await driver.find('#password').doClear().doSendKeys(oldpassword);
  await driver.find('#newpassword').doClear().doSendKeys(newpassword);
  await driver.find('input[type=submit]').doClick();
}

async function fill_quiz(numberOfQuestions: number, waitOnFirst: boolean, drv: WebDriver) {
  const exit = await drv.find("#btnExit");
  const next = await drv.find("#btnNext");

  for (let i: number = 0; i < numberOfQuestions; i++) {
    if (i === 0 && waitOnFirst) {
      await drv.sleep(2200);
    }
    await drv.find("[type='text']").doSendKeys(i.toString());
    if (i !== numberOfQuestions - 1) {
      await next.doClick();
    }
  }
  await exit.doClick();
}

describe('password_change_test', async () => {
  const sessions: client[] = [
    ...new Array(4).fill({
      login: "user1",
      password: "user1"
    }, 0, 4),
    ...new Array(3).fill({
      login: "user2",
      password: "user2"
    }, 0, 3)
  ];

  const userchanged: string = sessions[0].login;
  const oldpassword: string = sessions[0].password;
  const newpassword: string = 'When we have shuffled off this mortal coil';


  it("runs many coexisting sessions", async function() {
    this.timeout(20000);

    for (const session of sessions) {
      await driver.get(mainPath);
      await assert_logged_out();
      await log_in(session);
      await assert_logged_in();

      session.sid = await driver.manage().getCookie('connect.sid');
      await driver.manage().deleteCookie('connect.sid');
    }

    for (const session of sessions) {
      await driver.manage().addCookie({name: session.sid.name, value: session.sid.value});
      await driver.get(mainPath);
      await assert_logged_in_as_user(session.login);
    }
  });

  it("changes password", async function() {
    this.timeout(20000);
    await driver.manage().addCookie({name: sessions[0].sid.name, value: sessions[0].sid.value});
    await change_password({oldpassword, newpassword});
  });

  it("logs off all user's sessions after changing password, but not other users' sessions", async function() {
    this.timeout(20000);

    for (const session of sessions) {
      await driver.manage().addCookie({name: session.sid.name, value: session.sid.value});
      await driver.get(mainPath);
      if (session.login === userchanged) {
        await assert_logged_out();
      } else {
        await assert_logged_in_as_user(session.login);
      }
    }
  });

  it('blocks an old password', async function() {
    this.timeout(20000);
    await driver.manage().deleteCookie('connect.sid');
    await driver.get(mainPath);

    await log_in({login: userchanged, password: oldpassword});
    await assert_logged_out();
  });

  it("logs in using new password", async function() {
    this.timeout(20000);
    await log_in({login: userchanged, password: newpassword});
    await assert_logged_in();
  });

  it("changes the password back", async function() {
    this.timeout(20000);
    await change_password({newpassword: oldpassword, oldpassword: newpassword});
    await assert_logged_out();
  });
})


describe('solve_quiz_test', async () => {
  const credentials = {login: "user2", password: "user2"};
  let numberOfQuestions: number;
  let driver2: WebDriver;
  let url: string;

  it("logs in", async function() {
    this.timeout(10000);
    await driver.get(mainPath);
    await log_in(credentials);
  });

  it("chooses a first unsolved quiz and starts it", async function() {
    this.timeout(20000);
    await driver.sleep(2000);
    const element = await driver.findContent("a", "Start");
    await driver.executeScript("arguments[0].scrollIntoView()", element);
    await element.doClick();
    await driver.find("[type='text']").value();

    // clone driver
    driver2 = new Builder().forBrowser("firefox").build();
    await driver2.get(mainPath);
    driver2.manage().addCookie({
      name: 'connect.sid',
      value: (await driver.manage().getCookie('connect.sid')).value
    });
    url = await driver.getCurrentUrl();
    driver2.get(url);
  });

  it("solves a quiz", async function() {
    this.timeout(40000);

    numberOfQuestions = Number(await driver.find("#liczbaPytan").getText());
    expect(numberOfQuestions).to.not.be.an('undefined');
    expect(numberOfQuestions).to.be.greaterThan(0);
    await fill_quiz(numberOfQuestions, true, driver);
  });

  it("checks if time statistics match the time spent at each question", async function() {
    this.timeout(20000);
    const regex: RegExp = new RegExp(/Your time: (\d+)(\.\d+)?s/g);
    const page = await driver.find('body').getText();

    for (let i: number = 0; i < numberOfQuestions; i++) {
      const match = regex.exec(page);
      if (i === 0) {
        expect(match[1]).to.equal("2");
      } else {
        expect(match[1]).to.equal("0");
      }
    }
  });

  it(`solves previously loaded, very same quiz 2nd time and ensures server will not accept the results`, async function() {
    this.timeout(40000);

    await fill_quiz(numberOfQuestions, false, driver2);
    expect(await driver2.find("body").getText()).to.contain("User is not allowed");

    driver2.close();
  });

  it(`follows url that was used to start a quiz, but now it is a result screen`, async function() {
    this.timeout(40000);

    await driver.get(url);
    await driver.findContent("h1", "Quiz results");
  });
})