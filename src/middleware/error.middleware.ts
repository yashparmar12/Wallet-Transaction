export const errorHandler = (err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Internal Server Error" });
}