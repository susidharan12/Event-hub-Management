require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

module.exports = JWT_SECRET;
