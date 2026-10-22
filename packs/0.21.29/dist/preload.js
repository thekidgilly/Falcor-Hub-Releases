"use strict";

// src/preload.ts
var import_electron = require("electron");
var CALLS = [
  "status",
  "frame",
  "autopilot",
  "take",
  "release",
  "input",
  "stopAll",
  "clear",
  "refreshApps",
  "createTask",
  "editTask",
  "taskFields",
  "approveTask",
  "taskAction",
  "saveKimi",
  "removeKimi",
  "testKimi",
  "setRouting",
  "pairPhone",
  "unpairPhone",
  "setSecret",
  "removeSecret",
  "viewer",
  "firewall",
  "updateCheck",
  "updateRestart",
  "dismissWhatsNew",
  "videoStart",
  "videoStop",
  "teachTarget",
  "teachStart",
  "teachPause",
  "teachMark",
  "teachStop",
  "teachProgress",
  "teachEstimate",
  "teachWrite",
  "learned",
  "shot",
  "saveGuide",
  "renameApp",
  "deleteShot",
  "deleteApp",
  "exportApp",
  "setLimit",
  "appIcon",
  "openApp",
  "setAds",
  "gameTell",
  "gameAutopilot",
  "gamePlaybook",
  "gameTeach",
  "captureOffer",
  "captureStart",
  "captureMore",
  "captureFinish",
  "captureCancel",
  "captureAuto",
  "captureStop",
  "views",
  "installedApps",
  "saveOffer",
  "tickOffer",
  "setMilestone",
  "offerStarted",
  "removeOffer",
  "removeGame",
  "ai",
  "chatThreads",
  "chatRead",
  "chatNew",
  "chatSend",
  "chatAct",
  "chatRename",
  "chatPin",
  "chatDelete",
  "chatFocus",
  "noticesRead",
  "noticesClear",
  "sandbox",
  "queue"
];
import_electron.contextBridge.exposeInMainWorld("hub", {
  call: (name, args) => {
    if (!CALLS.includes(name)) throw new Error("Unknown call.");
    return import_electron.ipcRenderer.invoke(name, args || {});
  },
  onStatus: (fn) => {
    import_electron.ipcRenderer.on("status", (_e, s) => fn(s));
  },
  onVideo: (fn) => {
    import_electron.ipcRenderer.on("video", (_e, p) => fn(p));
  },
  // The engine asks the window for its decoded video frame (a look's picture without a screen capture); the window answers.
  // The owner's fast touches (main.ts 'touch'): fire and forget, many a second while a finger moves.
  touch: (p) => {
    import_electron.ipcRenderer.send("touch", p);
  },
  onFrameWanted: (fn) => {
    import_electron.ipcRenderer.on("frameWanted", (_e, p) => fn(p));
  },
  frameTaken: (p) => {
    import_electron.ipcRenderer.send("frameTaken", p);
  }
});
