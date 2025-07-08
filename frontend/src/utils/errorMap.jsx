export const errorMap = {

    bad_format: {
        color: "red",
        label: "Bad Format",
        chessSymbol: "chess-symbol chess-blunder",
        useServerMessage: true,
        showToast: true
    },
    invalid_credentials: {
        color: "red",
        label: "Bad Credentials",
        chessSymbol: "chess-symbol chess-blunder",
        showToast: true
    },
    username_already_exists: {
        color: "yellow",
        label: "Username already exists",
        chessSymbol: "chess-symbol chess-mistake",
        showToast: true
    },
    server_error: {
        color: "yellow",
        label: "Server error. Try again later.",
        chessSymbol: "chess-symbol chess-mistake",
        showToast: true
    }
};

export const successMap = {
    signin: {
        color: "green",
        label: "Login successful",
        chessSymbol: "chess-symbol chess-best",
        showToast: true
    },
    signup: {
        color: "green",
        label: "Account created successfully",
        chessSymbol: "chess-symbol chess-best",
        showToast: true
    }
};