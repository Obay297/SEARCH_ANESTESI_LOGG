//patient.js: The first function (setAutomaticDate) populates the patient form with the current date and time if the field is empty. 
//and the second function(getPatientFormData) uses all the data entered into the form and returns it as a sorted object for later saving or processing.

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
