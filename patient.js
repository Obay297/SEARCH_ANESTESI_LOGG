/**
 * patient.js
 * ----------
 * Utilities for reading and managing the patient information form.
 *
 * This module does not maintain any state of its own — it only reads
 * values from the DOM and returns plain objects that other modules
 * (app.js) can store and send to the backend.
 */


/**
 * Pre-fill the date/time field with the current local date and time.
 *
 * The field is left unchanged if it already contains a value, so that
 * re-opening the form after a recording has started does not overwrite
 * a manually entered date.
 *
 * @param {HTMLFormElement|null} form - The patient information form element.
 */
export function setAutomaticDate(form) {
  if (!form) return;

  const dateInput = form.querySelector('#input-date');
  if (!dateInput) return;
  if (dateInput.value) return; // do not overwrite a manually entered value

  const now = new Date();
  const pad  = (n) => String(n).padStart(2, '0');

  // datetime-local inputs expect the format "YYYY-MM-DDTHH:MM".
  const localDateTime =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  dateInput.value = localDateTime;
}


/**
 * Read all patient form fields and return them as a plain object.
 *
 * Returns an object with empty string defaults for every field so that
 * callers never have to guard against missing keys.
 *
 * @param {HTMLFormElement|null} form - The patient information form element.
 * @returns {{
 *   date: string,
 *   id: string,
 *   project: string,
 *   participants: string,
 *   weight: string,
 *   sedationTime: string,
 *   intubationTime: string,
 *   incisionTime: string,
 *   tubeSize: string,
 *   drugName: string,
 *   notes: string
 * }}
 */
export function getPatientFormData(form) {
  if (!form) {
    return {
      date:           '',
      id:             '',
      project:        '',
      participants:   '',
      weight:         '',
      sedationTime:   '',
      intubationTime: '',
      incisionTime:   '',
      tubeSize:       '',
      drugName:       '',
      notes:          '',
    };
  }

  /** Helper: return the trimmed value of the named form field, or ''. */
  const fieldValue = (name) => {
    const element = form.querySelector(`[name="${name}"]`);
    return element ? element.value.trim() : '';
  };

  return {
    date:           fieldValue('date'),
    id:             fieldValue('patientId'),
    project:        fieldValue('project'),
    participants:   fieldValue('participants'),
    weight:         fieldValue('weight'),
    sedationTime:   fieldValue('sedationTime'),
    intubationTime: fieldValue('intubationTime'),
    incisionTime:   fieldValue('incisionTime'),
    tubeSize:       fieldValue('tubeSize'),
    drugName:       fieldValue('drugName'),
    notes:          fieldValue('patientNotes'),
  };
}
