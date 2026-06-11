import md5 from "md5";

export default async function authRoutes(app) {

  app.post("/login", async (request, reply) => {
    const { email, password } = request.body;

    const [rows] = await app.db.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return reply.code(401).send({ success: false, message: "Invalid credentials" });
    }

    const user = rows[0];
    const valid = md5(password) === user.password;

    if (!valid) {
      return reply.code(401).send({ success: false, message: "Invalid credentials" });
    }

    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: "never" }
    );

    return reply.send({ success: true, token });
  });

}