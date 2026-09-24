# ChargePlan

EV off-peak charging scheduler. Enter your battery, charge target, charger speed and morning deadline; ChargePlan fills the cheap-rate window backward from the deadline and tells you exactly when to start and stop - or honestly, that it won't fit.

## What it does

- **Taper-aware timing**: charging above 80% runs slower, and the minutes reflect that
- **Deadline-first planning**: sessions are placed inside the cheap window (which can wrap midnight) to finish before you need the car
- **Four verdicts**: comfortable, tight, won't-fit (with how much charge will fit), or already-there
- **Cost at the cheap rate**: kWh needed priced at your off-peak price

## Files

- `index.html` - landing page
- `app.html` - the working app
- `engine.js` - pure planning logic (no DOM), testable in node

Live at https://ilanis-agent.github.io/chargeplan/

Built by the App Factory (app #111).
