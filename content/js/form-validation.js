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
    for (const name in formError) {
        validateServerError(name);
    }
}

function validateServerError(name) {
    const input = document.getElementsByName(name)[0];
    if (!input) {
        console.error(`validateServerError(${name}): cannot find input element with name "${name}"`);
        return;
    }
    const invalidFeedback = document.getElementById(`${input.id}-invalid-feedback`);
    if (!invalidFeedback) {
        console.error(`validateServerError(${name}): cannot find invalid feedback element with id "${input.id}-invalid-feedback"`);
        return;
    }

    const defaultClientError = invalidFeedback.textContent;
    const serverError = formError[name]

    // Set server error
    if (serverError) {
        invalidFeedback.textContent = serverError;
        input.setCustomValidity("Invalid");
        input.classList.add('is-invalid');
    }

    // Reset error by replacing server error with default client error
    // when input changes or when parent form is submitted.
    let doResetError = true;
    const resetError = function () {
        if (doResetError && invalidFeedback.textContent === serverError) {
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
        console.error(`validatePasswordConfirm(): password confirm requires password element`);
        return;
    } else if (!invalidFeedback) {
        console.error(`validatePasswordConfirm(): password confirm requires invalid feedback element`);
        return;
    }

    const defaultInvalidFeedback = invalidFeedback.textContent;

    const confirmPassword = function (event) {
        if (password.value === passwordConfirm.value) {
            invalidFeedback.textContent = defaultInvalidFeedback;
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

export async function validateEmailUnique() {
    const email = document.getElementsByName("email")[0];
    if (!email) {
        console.error(`validateEmailUnique(): Require element with name "email"`);
        return;
    }

    const invalidFeedback = document.getElementById("email-invalid-feedback");
    if (!invalidFeedback) {
        console.error(`validateEmailUnique(): Require element with ID "email-invalid-feedback"`);
        return;
    }

    const defaultInvalidFeedback = invalidFeedback.textContent;
    const errorMessage = "Email already taken.";
    const emails = new Set();

    const doValidateEmailUnique = async function (event) {
        const emailValue = event.type !== 'paste' ? email.value : (event.clipboardData || window.clipboardData).getData('Text');

        // When our custom error is shown.
        if (email.validity.customError && email.validationMessage === errorMessage) {
            // When email is known to be taken do nothing.
            if (emails.has(emailValue)) {
                return;
            } else { // When email has not yet been verified remove custom error.
                invalidFeedback.textContent = defaultInvalidFeedback;
                email.setCustomValidity(""); // Not shown but prevents form submission.
                email.classList.remove('is-invalid');
            }
        }

        // Do NOT proceed when:
        // - Event is not a blur event, or;
        // - Email is invalid, or;
        // - Email has different custom error.
        if (
            event.type !== 'blur' ||
            (!email.checkValidity() && !email.validity.customError) ||
            (email.validity.customError && email.validationMessage !== errorMessage)
        ) {
            return;
        }

        // Check with server whether email is taken.
        if (!emails.has(emailValue)) {
            const url = "http://127.0.0.1:8080/users";
            const query = new URLSearchParams({'email': emailValue});
            const response = await fetch(`${url}?${query}`);
            if (response.status < 200 || response.status >= 400) {
                console.error(`validateEmailUnique(): Unknown API error: ${response.status} ${response.statusText}`);
                return;
            }

            const payload = await response.json();
            if (!Object.hasOwn(payload, 'users')) {
                console.error(`validateEmailUnique(): invalid fetch response: require json property "users"`);
                return;
            }
            if (!Array.isArray(payload.users)) {
                console.error(`validateEmailUnique(): invalid fetch response: require "users" to be an array`);
                return;
            }

            if (payload.users.length > 0) {
                emails.add(emailValue);
            }
        }

        // When email is taken add custom error.
        if (emails.has(emailValue)) {
            invalidFeedback.textContent = errorMessage;
            email.setCustomValidity(errorMessage); // Not shown but prevents form submission.
            email.classList.add('is-invalid');
        }
    };

    // email.addEventListener('blur', doValidateEmailUnique);
    for (const event of ['blur', 'change', 'keyup', 'paste']) {
        email.addEventListener(event, doValidateEmailUnique);
    }
}
