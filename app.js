let express = require("express");
let app = express();
let path = require("path");
let { open } = require("sqlite");
let sqlite3 = require("sqlite3");
let jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
let dbPath = path.join(__dirname, "twitterClone.db");
app.use(express.json());
let db = null;
let dataBaseStart = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("app started");
    });
  } catch (e) {
    console.log(`${e.message}`);
    process.exit(1);
  }
};
const Authenticate = async (request, response, next) => {
  console.log(1);
  let { username, password } = request.body;
  console.log(username);
  let result = await db.get(
    `select * from user where username like '${username}';`
  );
  if (result !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      next();
    }
  }
};
app.post("/register/", Authenticate, async (request, response) => {
  let { username, password, name, gender } = request.body;
  password = await bcrypt.hash(password, 10);
  let query = `insert into user(name,username,password,gender)
      values('${name}','${username}','${password}','${gender}');`;
  let result = await db.run(query);
  response.send("User created successfully");
});
const AuthenticateUser = async (request, response, next) => {
  const { username, password } = request.body;
  let result = await db.get(
    `select * from user where username like '${username}';`
  );
  if (result === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    result = await db.get(
      `select * from user where username like '${username}';`
    );
    console.log(result.password);
    if (!(await bcrypt.compare(password, result.password))) {
      response.status(400);
      response.send("Invalid password");
    } else {
      next();
    }
  }
};
app.post("/login/", AuthenticateUser, async (request, response) => {
  let payload = { username: request.body.username };
  let jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
  console.log(jwtToken);
  response.send({ jwtToken: jwtToken });
});
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
const changeObjectFormat = (username, dbObject) => ({
  username: username,
  tweet: dbObject.tweet,
  dateTime: dbObject.date_time,
});
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  console.log(1);
  const { username } = request;
  console.log(username);
  let result = await db.all(
    `select tweet,user_id,date_time from tweet where user_id=(select user_id from user where username like '${username}') order by date_time desc limit 4;`
  );

  console.log(result);
  result = result.map((dbObject) => changeObjectFormat(username, dbObject));
  response.send(result);
});
const changeObjectFormat1 = (dbObject) => ({
  name: dbObject.username,
});
app.get("/user/following/", authenticateToken, async (request, response) => {
  console.log(1);
  const { username } = request;
  console.log(username);
  let result = await db.all(
    `select username from user where user_id=(select following_user_id from follower where follower_user_id=(select user_id from user where username like '${username}'));`
  );
  console.log(result);

  result = result.map((dbObject) => changeObjectFormat1(dbObject));
  response.send(result);
});
app.get("/user/followers/", authenticateToken, async (request, response) => {
  console.log(1);
  const { username } = request;
  console.log(username);
  let result = await db.all(
    `select username from user where user_id=(select follower_user_id from follower where following_user_id=(select user_id from user where username like '${username}'));`
  );
  console.log(result);

  result = result.map((dbObject) => changeObjectFormat1(dbObject));
  response.send(result);
});
app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  let result = await db.all(
    `select following_user_id from follower where follower_user_id=(select user_id from user where username like '${username}');`
  );
  let newArray = result.map((obj) => obj.following_user_id);
  console.log(newArray);
  result = await db.get(
    `select tweet,date_time,user_id from tweet where tweet_id=${tweetId};`
  );
  if (newArray.includes(result.user_id)) {
    countLikes = await db.get(
      `select count(like_id) from like where tweet_id=${tweetId}`
    );
    countReplies = await db.get(
      `select count(reply_id) from reply where tweet_id=${tweetId}`
    );
    const result1 = {
      tweet: result.tweet,
      likes: countLikes["count(like_id)"],
      replies: countReplies["count(reply_id)"],
      dateTime: result.date_time,
    };
    response.send(result1);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    let result = await db.all(
      `select following_user_id from follower where follower_user_id=(select user_id from user where username like '${username}');`
    );
    let newArray = result.map((obj) => obj.following_user_id);
    console.log(newArray);
    result = await db.get(
      `select tweet,date_time,user_id from tweet where tweet_id=${tweetId};`
    );
    console.log(result.user_id);
    if (newArray.includes(result.user_id)) {
      countLikes = await db.all(
        `select user.username from user natural join like where tweet_id=${tweetId};`
      );
      countLikes = countLikes.map((user) => user.username);
      const result1 = {
        likes: countLikes,
      };
      response.send(result1);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    let result = await db.all(
      `select following_user_id from follower where follower_user_id=(select user_id from user where username like '${username}');`
    );
    let newArray = result.map((obj) => obj.following_user_id);
    console.log(newArray);
    result = await db.get(
      `select user_id from reply where tweet_id=${tweetId};`
    );
    console.log(result.user_id);
    if (newArray.includes(result.user_id)) {
      countLikes = await db.all(
        `select user.username,reply.reply from user natural join reply where tweet_id=${tweetId};`
      );
      countLikes = countLikes.map((user) => ({
        name: user.username,
        reply: user.reply,
      }));
      const result1 = {
        likes: countLikes,
      };
      response.send(result1);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get("/user/tweets", authenticateToken, async (request, response) => {
  const { username } = request;
  let result = await db.all(
    `select tweet_id from tweet where user_id=(select user_id from user where username='${username}');`
  );
  let newArray = result.map((obj) => obj.tweet_id);

  result = newArray.map(async (tweetId) => {
    let res1 = await db.get(
      `select tweet,date_time,user_id from tweet where tweet_id=${tweetId};`
    );
    return res1;
  });
  console.log(result);
  let countLikes = newArray.map(async (tweetId) => {
    let res1 = await db.get(
      `select count(like_id) from like where tweet_id=${tweetId}`
    );
    return res1;
  });
  let countReplies = newArray.map(async (tweetId) => {
    let res1 = await db.get(
      `select count(reply_id) from reply where tweet_id=${tweetId}`
    );
    return res1;
  });
  let result1 = [];
  for (let i = 0; i < result.length; i += 1) {
    result1.push({
      tweet: result[i].tweet,
      likes: countLikes[i]["count(like_id)"],
      replies: countReplies[i]["count(reply_id)"],
      dateTime: result[i].date_time,
    });
  }
  response.send(result1);
});
app.post("/user/tweets", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  let userId = await db.get(
    `select user_id from user where username='${username}';`
  );
  console.log(userId.user_id);
  var tempDate = new Date();
  console.log(tempDate);
  let res = await db.run(
    `insert into tweet(tweet,user_id) values('${tweet}',${userId.user_id});`
  );
  response.send("Created a Tweet");
});
app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  let result = await db.get(
    `select user_id from user where username='${username}';`
  );

  let userId = await db.get(
    `select user_id from tweet where tweet_id=${tweetId};`
  );
  if (result.user_id === userId.user_id) {
    result = await db.get(`delete from tweet where tweet_id=${tweetId};`);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
dataBaseStart();
module.exports = app;
