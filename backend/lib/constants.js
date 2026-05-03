const VALID_GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E", "F"];

/** Grade letter → GPA points (4.0 scale) */
const GRADE_TO_POINT = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  D: 1.0,
  E: 0.5,
  F: 0,
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(str) {
  return typeof str === "string" && str.length >= 3 && str.length <= 255 && EMAIL_REGEX.test(str.trim());
}

module.exports = { VALID_GRADES, GRADE_TO_POINT, EMAIL_REGEX, isValidEmail };
