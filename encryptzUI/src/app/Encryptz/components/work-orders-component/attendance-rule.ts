/**
 * May the user start / complete a job now? Back office always; a technician when checked in,
 * or when their attendance check-in is not required (Technicians › detail). The API decides too.
 */
export function canWorkWithoutCheckIn(isAdmin: boolean, checkedIn: boolean, attendanceRequired: boolean): boolean {
  return isAdmin || checkedIn || !attendanceRequired;
}
