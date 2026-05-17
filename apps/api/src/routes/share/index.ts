// Share card routes (VoteNow social sharing). Stub until ported.
import { Hono } from "hono";

export const shareRouter = new Hono();

shareRouter.get("/share/preview/:cardType{.+\\.svg}", (c) =>
  c.text("<!-- not yet ported -->", 501, { "Content-Type": "image/svg+xml" }),
);
shareRouter.get("/share/:cardType", (c) =>
  c.html("<html><body>Share page not yet ported.</body></html>", 501),
);
