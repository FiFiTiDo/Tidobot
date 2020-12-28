const fs = require("fs");

const token = require('crypto').randomBytes(256).toString('base64');
fs.writeFileSync("JWT_SECRET", token);
console.info("Generated new secret token");