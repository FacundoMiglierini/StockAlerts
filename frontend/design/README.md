# Design reference

Source files from the Claude Design canvas used to design this app's UI
(alarms dashboard desktop/mobile, admin users tab, login + password
recovery, settings, mobile create-alarm screen). `.dc.html` files are
Design Component markup, not part of the build — reference only for the
visual design (palette, typography, spacing, component states) the app was
refactored to match.

Live canvas: https://claude.ai/code/artifact/78bdff11-62da-4aad-9772-4a1cfc9bd9bb

Last synced: 2026-09-13 (three passes same day):
1. Added `AdminDesktop`/`AdminMobile`, replaced `Main`/`DashboardMobile`
   with the redesigned alarm cards + filters bar, and replaced `Login`
   with `AuthFlow` — sign-in plus the "forgot password" / "check your
   email" / "set new password" states.
2. Added an Appearance section (System/Light/Dark theme picker) to
   `Settings.dc.html`, and brought its header nav (icons, Admin tab, email
   placeholder) in line with the other artboards — it was still on the
   original 2-tab header from before the admin tab existed.
3. Added `AdminInvite.dc.html` (the invite modal — email + role picker)
   and a 5th "Accept invite" state to `AuthFlow.dc.html`; updated
   `AdminDesktop`/`AdminMobile` to show a locked "Default admin" row with
   no action buttons for the seed-created account. Approved as designed
   and implemented for both frontend and backend the same day (see
   backend/CLAUDE.md's "Inviting users").

`CreateAlarmMobile.dc.html` remains unchanged from the original design.
