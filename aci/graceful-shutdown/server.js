const express = require('express');
const app = express();
const morgan  = require('morgan');

app.use(express.urlencoded({extended: true})); 
app.use(express.json());
app.use(morgan('combined'));

var port = process.env.PORT || 8080;

app.get('/', async (req, res) => {
  res.send('Success!').status(200);
});

//process.stdin.resume();
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
});

app.listen(port, () => console.log("Listening on: %s", port));