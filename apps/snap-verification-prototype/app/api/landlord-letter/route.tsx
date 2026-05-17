/* @jsxImportSource react */
import React from "react";
import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export const runtime = "nodejs";

const s = StyleSheet.create({
  page: { padding: 54, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5 },
  h1: { fontSize: 16, marginBottom: 14, fontFamily: "Helvetica-Bold" },
  field: { marginVertical: 6, borderBottomWidth: 1, borderBottomColor: "#888", paddingBottom: 2 },
  sig: { marginTop: 36, flexDirection: "row" },
  sigCol: { flex: 1, marginRight: 12 },
});

function Letter({ address, leaseholder, applicant, amount }: {
  address: string; leaseholder: string; applicant: string; amount: string;
}) {
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Landlord / Primary Leaseholder Statement</Text>
        <Text>
          To Whom It May Concern (SNAP Verification),
        </Text>
        <Text style={{ marginTop: 12 }}>
          I, the undersigned primary leaseholder, confirm that the individual named below
          resides at the address below and contributes the monthly amount stated toward rent.
          This statement is provided in support of their SNAP application.
        </Text>

        <Text style={{ marginTop: 18, fontFamily: "Helvetica-Bold" }}>Residence address</Text>
        <View style={s.field}><Text>{address || " "}</Text></View>

        <Text style={{ marginTop: 6, fontFamily: "Helvetica-Bold" }}>Primary leaseholder name</Text>
        <View style={s.field}><Text>{leaseholder || " "}</Text></View>

        <Text style={{ marginTop: 6, fontFamily: "Helvetica-Bold" }}>Applicant name</Text>
        <View style={s.field}><Text>{applicant || " "}</Text></View>

        <Text style={{ marginTop: 6, fontFamily: "Helvetica-Bold" }}>Monthly rent share paid by applicant</Text>
        <View style={s.field}><Text>{amount ? `$${amount}` : " "}</Text></View>

        <View style={s.sig}>
          <View style={s.sigCol}>
            <Text> </Text>
            <View style={s.field}><Text> </Text></View>
            <Text>Leaseholder signature</Text>
          </View>
          <View style={{ width: 160 }}>
            <Text> </Text>
            <View style={s.field}><Text> </Text></View>
            <Text>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pdf = await renderToBuffer(
    <Letter
      address={url.searchParams.get("address") ?? ""}
      leaseholder={url.searchParams.get("leaseholder") ?? ""}
      applicant={url.searchParams.get("applicant") ?? ""}
      amount={url.searchParams.get("amount") ?? ""}
    />
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="landlord-letter.pdf"`,
    },
  });
}
