const Instagram = require("instagram-web-api");
const bus = require("bus-bus-bus");
const { INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD } = process.env;

async function login(){
  const client = new Instagram({ username:INSTAGRAM_USERNAME, password:INSTAGRAM_PASSWORD });
  await client.login();
  
  return client;
}

class InstagramService{
  constructor(){
    this.outstandingRequests = 0;
    this.mailbox = [];
    this.maxOutstanding = 6;
    this.telemetryInterval = setInterval(() => {
      bus.emit("telemetry", {emitter:"insta-insta-insta", name:"instagram.telemetry", outstandingRequests:this.outstandingRequests, mailboxSize:this.mailbox.length});
    }, 5000);
    
    bus.on("globalShutdown", () => {
      clearInterval(this.telemetryInterval);
    });
    
    bus.on("InstagramService:getProfile", this.callClient("InstagramService:getProfile", async (returnService) => {
      let client;
      try{
        client = await login();
        let profile = await client.getProfile();
        bus.emit(returnService, null, profile);
      } catch(err){
        bus.emit(returnService, err);
      } finally{
        await client.logout();
      }
    }));
    bus.on("InstagramService:uploadPhoto", this.callClient("InstagramService:uploadPhoto", async (returnService, {photo, caption = "", post = "feed"}) => {
      let client;
      try{
        client = await login();
        await client.uploadPhoto();
        bus.emit(returnService, null, "OK");
      } catch(err){
        bus.emit(returnService, err);
      } finally{
        await client.logout();
      }
    }));
  }
  
  async invoke(){
    if(this.mailbox.length > 0 && this.maxOutstanding >= this.outstandingRequests){
      let {event, returnService, params, invokeFunc} = this.mailbox.shift();
      bus.emit("log", {emitter:"insta-insta-insta", message:"Request started", event, params, returnService});
      let timer = Date.now();
      try{
        await invokeFunc();
        bus.emit("telemetry", {emitter:"insta-insta-insta", time:Date.now() - timer, event, params, status:"success", returnService, name:"instagram.request.time"})
      } catch(e){
        bus.emit("telemetry", {emitter:"insta-insta-insta", time:Date.now() - timer, event, params, status:"error", returnService, name:"instagram.request.time", error:e})
      }
    }
  }
  
  callClient(event, func){
    return (returnService, params) => {
      this.mailbox.push({event, returnService, params, invokeFunc: async () => {
        this.outstandingRequests++;
        try{
          await func(returnService, params);
        } catch(err){
          throw err;
        } finally{
          this.outstandingRequests--;
          setTimeout(() => {this.invoke();}, 0);
        }
      }});
      setTimeout(() => {this.invoke();}, 0);
    }
  }
}

module.exports = InstagramService;