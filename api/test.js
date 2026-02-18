module.exports = function(req, res) {
  res.status(200).json({
    test: "working",
    key: process.env.RAPIDAPI_KEY ? "found" : "missing",
    nodeVersion: process.version
  });
};
