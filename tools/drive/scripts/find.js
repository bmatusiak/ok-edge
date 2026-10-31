'use strict';
/* the screen's lines that contain a text, as the app sends them:  run.js find <text> */
module.exports = async (d, [text = '']) => {
  for (const l of d.app.text.split('\n').filter((x) => x.includes(text))) d.say(JSON.stringify(l));
};
