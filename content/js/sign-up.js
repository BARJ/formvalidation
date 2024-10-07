import {validateForm, validateEmailUnique} from './form-validation.js';

document.addEventListener("DOMContentLoaded", function() {
    validateForm();
    void validateEmailUnique();
});
