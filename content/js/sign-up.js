(function () {
    const disableClientSideValidation = false;
    console.log("formError: %s", typeof formError !== "undefined" ? JSON.stringify(formError) : "undeclared");

    if (!disableClientSideValidation) {
        subscribeConfirmPasswordFormValidation();
    }

    // Server-side form validation for email, firstname, surname, and password.
    for (const id of ['email', 'firstname', 'surname', 'password', 'password-confirm']) {
        validateFormServerError(id);
    }

    // Enable Bootstrap form validation when form is submitted.
    Array.from(document.querySelectorAll('.needs-validation')).forEach(function (form) {
        form.addEventListener(
            'submit',
            function (event) {
                if (disableClientSideValidation) {
                    return;
                }
                if (!form.checkValidity()) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                form.classList.add('was-validated');
            }
        );
    });
})();

function subscribeConfirmPasswordFormValidation() {
    const password = document.getElementById("password");
    const passwordConfirm = document.getElementById("password-confirm");
    const invalidFeedback = document.getElementById("password-confirm-invalid-feedback");
    if (!password) {
        console.log(`cannot find password element`);
        return;
    } else if (!passwordConfirm) {
        console.log(`cannot find password confirm element`);
        return;
    } else if (!invalidFeedback) {
        console.log(`cannot find password confirm invalid feedback element`);
        return;
    }

    const defaultClientError = invalidFeedback.textContent;

    const confirmPassword = function () {
        if (password.value === passwordConfirm.value) {
            invalidFeedback.textContent = defaultClientError;
            passwordConfirm.setCustomValidity("");
            passwordConfirm.classList.remove('is-invalid');
        } else {
            invalidFeedback.textContent = "Password does not match.";
            passwordConfirm.setCustomValidity("Invalid"); // Not shown but prevents form submission.
            passwordConfirm.classList.add('is-invalid');
        }
    };
    for (const event of ['keyup', 'change']) {
        passwordConfirm.addEventListener(event, confirmPassword);
    }
    if (passwordConfirm.form) {
        passwordConfirm.form.addEventListener('submit', confirmPassword);
    }
}

function validateFormServerError(id) {
    const input = document.getElementById(id);
    const invalidFeedback = document.getElementById(id + "-invalid-feedback");
    if (!input || !input.hasAttribute("name")) {
        console.log(`validateFormServerError(${id}): cannot find input element`);
        return;
    } else if (!invalidFeedback) {
        console.log(`validateFormServerError(${id}): cannot find invalid feedback element`);
        return;
    }

    const defaultClientError = invalidFeedback.textContent;
    const serverError = getFormErrorByName(input.getAttribute("name"));

    // Set server error
    if (serverError) {
        console.log(`validateFormServerError(${id}): Set server error "${serverError}"`);
        invalidFeedback.textContent = serverError;
        input.setCustomValidity("Invalid");
        input.classList.add('is-invalid');
    }

    // Reset error by replacing server error with default client error
    // when input changes or when parent form is submitted.
    let doResetError = true;
    const resetError = function () {
        if (doResetError && invalidFeedback.textContent === serverError) {
            console.log(`subscribeFormInput(${id}): Remove server error "${serverError}"`);
            invalidFeedback.textContent = defaultClientError;
            input.setCustomValidity("");
            input.classList.remove("is-invalid");
        }
        doResetError = false;
    };
    for (const event of ['keyup', 'change']) {
        input.addEventListener(event, resetError, {once: true});
    }
    if (input.form) {
        input.form.addEventListener('submit', resetError, {once: true});
    }
}

function getFormErrorByName(name) {
    if (typeof formError === 'undefined' || !formError || !formError[name]) {
        return null;
    } else {
        return formError[name];
    }
}