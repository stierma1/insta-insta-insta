let InstagramService = require("./instagram-service");
let bus = require("bus-bus-bus");


new InstagramService();

bus.requestResponse("InstagramService:getProfile")
  .then((profile) => {
    console.log(profile);
  })