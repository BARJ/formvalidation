export function validateForm() {
    validatePasswordConfirm();
    validateServerErrors();

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
}

function validateServerErrors() {
    if (typeof formError === "undefined") {
        formError = {};
    }
    console.log(`formError: ${JSON.stringify(formError)}`);
    for (const name in formError) {
        validateServerError(name);
    }
}

function validateServerError(name) {
    const input = document.getElementsByName(name)[0];
    if (!input) {
        console.log(`validateFormServerError(${name}): cannot find input element with name "${name}"`);
        return;
    }
    const invalidFeedback = document.getElementById(`${input.id}-invalid-feedback`);
    if (!invalidFeedback) {
        console.log(`validateFormServerError(${name}): cannot find invalid feedback element with id "${input.id}-invalid-feedback"`);
        return;
    }

    const defaultClientError = invalidFeedback.textContent;
    const serverError = formError[name]

    // Set server error
    if (serverError) {
        console.log(`validateFormServerError(${name}): Set server error "${serverError}"`);
        invalidFeedback.textContent = serverError;
        input.setCustomValidity("Invalid");
        input.classList.add('is-invalid');
    }

    // Reset error by replacing server error with default client error
    // when input changes or when parent form is submitted.
    let doResetError = true;
    const resetError = function () {
        if (doResetError && invalidFeedback.textContent === serverError) {
            console.log(`subscribeFormInput(${name}): Remove server error "${serverError}"`);
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

function validatePasswordConfirm() {
    const passwordConfirm = document.getElementById("password-confirm");
    if (!passwordConfirm) {
        return;
    }

    const password = document.getElementById("password");
    const invalidFeedback = document.getElementById("password-confirm-invalid-feedback");
    if (!password) {
        console.log(`Password confirm requires find password element`);
        return;
    } else if (!invalidFeedback) {
        console.log(`Password confirm requires invalid feedback element`);
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
