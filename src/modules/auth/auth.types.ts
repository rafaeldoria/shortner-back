export interface RegisterDTO {
    username: string;
    email: string;
    password: string;
}

export interface LoginDTO {
    login: string;
    password: string;
}

export interface ChangePasswordDTO {
    currentPassword: string;
    newPassword: string;
}
