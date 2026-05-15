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
