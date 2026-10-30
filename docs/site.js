"use strict";

const PASSWORD_HASH = "9c7292555b6bcda7633db51f2426d4ca87df72add727ac64800329368a0827aa";
const gate = document.getElementById("gate");
const content = document.getElementById("content");
const form = document.getElementById("login-form");
const password = document.getElementById("password");
const error = document.getElementById("login-error");

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function unlock() {
  gate.hidden = true;
  content.hidden = false;
  sessionStorage.setItem("hmis-pages-unlocked", "1");
}

if(sessionStorage.getItem("hmis-pages-unlocked") === "1") unlock();

form.addEventListener("submit", async event => {
  event.preventDefault();
  const valid = await sha256(password.value) === PASSWORD_HASH;
  if(valid) {
    error.hidden = true;
    password.value = "";
    unlock();
    return;
  }
  error.hidden = false;
  password.select();
});

