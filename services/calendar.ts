import { Appointment } from "../types";

export const generateGoogleCalendarUrl = (appointment: Appointment): string => {
  const { title, date, time, location, notes, doctorName } = appointment;

  // Construct Start Date
  const startDate = new Date(`${date}T${time}`);
  // Assume 1 hour duration if not specified
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatTime = (dateObj: Date) => {
    return dateObj.toISOString().replace(/-|:|\.\d+/g, "");
  };

  const startStr = formatTime(startDate);
  const endStr = formatTime(endDate);

  const description = `Doctor: ${doctorName}\n\nNotes/Symptoms: ${notes}\n\nRecorded via Medical Notebook`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Appt: ${title} w/ ${doctorName}`,
    dates: `${startStr}/${endStr}`,
    details: description,
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};