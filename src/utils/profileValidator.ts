export interface ProfileValidationResult {
    isValid: boolean;
    errors: string[];
}

const NAME_REGEX = /^[a-zA-Z0-9]+$/;

export function validateProfileName(
    name: string,
    existingProfiles: string[]
): ProfileValidationResult {
    const errors: string[] = [];

    if (!name || name.trim().length === 0) {
        errors.push("Profile name cannot be empty.");
    }

    if (!NAME_REGEX.test(name)) {
        errors.push(
            "Profile name must contain only letters and numbers (no spaces or special characters)."
        );
    }

    if (existingProfiles.includes(name)) {
        errors.push("Profile name must be unique.");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}
