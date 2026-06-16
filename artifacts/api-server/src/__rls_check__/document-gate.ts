import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrDocumentTable,
  hrEmployeesTable,
  hrTemplateTable,
  usersTable,
} from "@workspace/db";
import {
  createTemplate,
  generateDocument,
  getDocument,
  getTemplate,
  listDocuments,
  renderTemplate,
  updateTemplate,
} from "../services/hr-document-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Doc Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `docgate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  const [emp] = await db
    .insert(hrEmployeesTable)
    .values({ companyId, employeeNo: "E001", firstName: "Jane", lastName: "Doe", createdBy: actorId, updatedBy: actorId })
    .returning();

  // Pure merge-function check.
  const merged = renderTemplate("Dear {{firstName}} {{lastName}}, salary {{amount}} {{currency}}. {{unknown}}", {
    firstName: "Jane",
    lastName: "Doe",
    amount: 25000,
    currency: "AED",
  });
  const passMerge = merged === "Dear Jane Doe, salary 25000 AED. {{unknown}}";

  // CREATE template + read back + update.
  const tpl = await createTemplate(companyId, actorId, {
    name: "Offer Letter",
    body: "Dear {{firstName}} {{lastName}}, welcome to {{company}}.",
  });
  const tplBack = await getTemplate(companyId, tpl.id);
  const passTpl = !!tplBack && tplBack.name === "Offer Letter";
  await updateTemplate(companyId, actorId, tpl.id, { name: "Offer Letter v2" });
  const tplUpdated = await getTemplate(companyId, tpl.id);
  const passTplUpdate = tplUpdated?.name === "Offer Letter v2";

  // GENERATE document by merging template + data.
  const doc = await generateDocument(
    companyId,
    actorId,
    tpl.id,
    { firstName: "Jane", lastName: "Doe", company: "Teamframe" },
    { employeeId: emp.id, name: "Jane Offer" },
  );
  const docBack = doc ? await getDocument(companyId, doc.id) : null;
  const passGen =
    !!docBack &&
    docBack.content === "Dear Jane Doe, welcome to Teamframe." &&
    docBack.employeeId === emp.id &&
    docBack.templateId === tpl.id;

  const docs = await listDocuments(companyId, emp.id);
  const passList = docs.length === 1;

  console.log("=== Document/Template Gate (Prompt 6) ===");
  console.log(`template merge ({{tokens}} replaced, unknown left as-is) -> ${passMerge ? "PASS" : "FAIL"}`);
  console.log(`template create + read back -> ${passTpl ? "PASS" : "FAIL"}`);
  console.log(`template update reflected -> ${passTplUpdate ? "PASS" : "FAIL"}`);
  console.log(`document generated from template + data map -> ${passGen ? "PASS" : "FAIL"}`);
  console.log(`document read back / listed -> ${passList ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrDocumentTable).where(eq(hrDocumentTable.companyId, companyId));
  await db.delete(hrTemplateTable).where(eq(hrTemplateTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = passMerge && passTpl && passTplUpdate && passGen && passList;
  console.log(ok ? "=== Document gate PASSED ===" : "=== Document gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
