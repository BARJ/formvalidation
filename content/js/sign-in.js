(function () {
    console.log("formError: %s", typeof formError !== "undefined" ? JSON.stringify(formError) : "undeclared");

    // Server-side form validation for email and password.
    for (const id of ['email', 'password']) {
        validateFormServerError(id);
    }

    // Enable Bootstrap form validation when form is submitted.
    Array.from(document.querySelectorAll('.needs-validation')).forEach(function (form) {
        form.addEventListener(
            'submit',
            function (event) {
                if (!form.checkValidity()) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                form.classList.add('was-validated');
            }
        );
    });
})();

function validateFormServerError(id) {
    const input = document.getElementById(id);
    const invalidFeedback = document.getElementById(id + "-invalid-feedback");
    if (!input || !input.hasAttribute("name") || !invalidFeedback) {
        console.log(`validateFormServerError(${id}): cannot find element(s)`);
        return;
    }

    const defaultClientError = invalidFeedback.textContent;
    const serverError = getFormErrorByName(input.getAttribute("name"));

    // Set server error
    if (serverError) {
        console.log(`validateFormServerError(${id}): set server error "${serverError}"`);
        invalidFeedback.textContent = serverError;
        input.classList.add('is-invalid');
    }

    // Reset error by replacing server error with default client error
    // when input changes or when parent form is submitted.
    const resetError = function (event) {
        if (invalidFeedback.textContent === serverError) {
            console.log(`subscribeFormInput(${id}): remove server error "${serverError}"`);
            invalidFeedback.textContent = defaultClientError;
            input.classList.remove("is-invalid");
        }
    };
    for (const event of ['keyup', 'change']) {
        input.addEventListener(event, resetError);
    }
    if (input.form) {
        input.form.addEventListener('submit', resetError);
    }
}

function getFormErrorByName(name) {
    if (typeof formError === 'undefined' || !formError || !formError[name]) {
        return null;
    } else {
        return formError[name];
    }
}