const express = require("express");
const app = express();
const port = 8000;
const client = require("prom-client"); //metrics collection
const responseTime = require("response-time");
const { createLogger, transports } = require("winston");
const LokiTransport = require("winston-loki");
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

//custom histogram

const options = {
  transports: [
    new LokiTransport({
      labels: {
        appName: "express",
      },
      host: "http://127.0.0.1:3100",
    }),
  ],
};
const logger = createLogger(options);
const reqResTime = new client.Histogram({
  name: "http_express_req_res_time",
  help: "this tells how much time is taken by req and res",
  labelNames: ["method", "route", "status_code"],
  buckets: [1, 50, 100, 200, 400, 500, 800, 1000, 2000],
});

const totalReqCounter = new client.Counter({
  name: "total_req",
  help: "tells total req",
});
app.use(
  responseTime((req, res, time) => {
    totalReqCounter.inc();
    reqResTime
      .labels({
        method: req.method,
        route: req.url,
        status_code: res.statusCode,
      })
      .observe(time);
  })
);

// Fast route
app.get("/fast", (req, res) => {
  logger.info("fast route");
  res.send("This is a fast response!");
});

// Slow route
app.get("/slow", (req, res) => {
  logger.info("slow route");

  setTimeout(() => {
    res.send("This is a slow response!");
  }, 5000); // Delays the response by 5000 milliseconds (5 seconds)
});

app.get("/metrics", async (req, res) => {
  res.setHeader("Content-Type", client.register.contentType);
  const metrics = await client.register.metrics();
  res.send(metrics);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
