const url = "https://calendar.google.com/calendar/ical/th.thai%23holiday%40group.v.calendar.google.com/public/basic.ics";
const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
const text = await res.text();
console.log("First 500 chars:", text.substring(0, 500));
console.log("Has VEVENT:", text.includes("VEVENT"));
console.log("Has DTSTART:", text.includes("DTSTART"));
// Check format of DTSTART
const match = text.match(/DTSTART[^\r\n]*/);
console.log("DTSTART sample:", match?.[0]);
