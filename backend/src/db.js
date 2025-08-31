// db.js
const defaultUserHash =
  "$2b$10$Cx7EeyTaPcsKfoSZ8daSvOlixUVhhIY1C5DzgvIdJZUHuFs2JVkW.";

let users = [
  {
    id: "default-user-1",
    email: "aipencilclass@gmail.com",
    password: defaultUserHash,
    metaAccessToken: null,
  },
];

let otnTokens = {};

module.exports = {
  users,
  otnTokens,
};
