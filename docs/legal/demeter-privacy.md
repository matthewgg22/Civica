<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source: apps/web/lib/legal/. Regenerate: pnpm --filter web legal:md
     Redlines should be applied to the source, then regenerated. -->

# Privacy Policy

**Civica Technologies LLC** · Last updated 2026-08-22

*What Demeter collects when you ask it a question, and what it does not.*

> **STATUS: DRAFT — NOT IN EFFECT.**
> Written against the running code, not yet reviewed by counsel.
> See `docs/legal/README.md` for the open questions and the publish checklist.

## The short version

> We do not sell your information, and we do not share it for advertising.

> We are not the government. We do not report you to anyone, and we never volunteer what you tell us to immigration authorities.

> We do not use your conversations to train AI models.

> You can use Demeter without an account and without giving your name.

Those four sentences are the ones that matter most, so they are first. The rest of this page explains them, and tells you the one thing we do keep: a record of the questions asked and the answers given, so we can check whether Demeter is telling people the truth.

## What this policy covers

This policy covers Demeter, the free SNAP question-and-answer service operated by Civica Technologies LLC: the chat, the application-questions pages, conversations you save to an account, the outline you can email yourself, and the feedback form.

It does not cover the separate Civica application tool, which collects documents and sends an application packet to a state agency. That tool has its own terms, and this policy does not describe it.

Demeter is built for people in the United States, because SNAP is a United States program. We do not offer or direct it to people in the European Economic Area, the United Kingdom, or Switzerland, and it is not designed to meet those regions' data protection rules.

## Sensitive information

Some of what people mention while asking about SNAP is sensitive by any measure, and treated as sensitive by several state privacy laws: immigration status, disability, health conditions, and the fact that you are seeking public assistance at all.

> We do not use sensitive information to infer characteristics about you, to build a profile, to target anything at you, or for any purpose other than answering the question in front of us.

We do not ask for any of it. The structured-identifier filter runs on everything before it is stored, and the record we keep is not connected to your identity, because for anonymous chat we never had one.

## What we collect, and why

| What | Why we have it | How long we keep it |
| --- | --- | --- |
| The question you type, and the answer Demeter gives | To check whether Demeter's answers are accurate, and to fix them when they are not | 7 days (30 days if the answer was flagged for review) |
| A one-way scrambled version of your IP address | To stop one source from overwhelming the service and to keep the monthly cost from running away | The current rate-limit window and the current day |
| An anonymous session number | To tell one conversation apart from another when we review accuracy | With the accuracy record above |
| Your email address, only if you choose to make an account | So you can come back to a saved conversation, and so we can email your outline to you | Until you delete your account |
| Conversations you explicitly save | So they are there when you come back | Until you delete them |
| A partner organization's referral code, if you arrived through one | So a community organization can see that people it referred were helped | With the accuracy record above |

We do not collect your name, your Social Security number, your address, your date of birth, or your immigration status. Demeter does not ask for them, and you should not type them.

## What happens to what you type

Before your question leaves our server, it passes through a filter that removes structured identifiers: Social Security numbers, phone numbers, email addresses, dates written as dates, and long account, EBT or case numbers. The filter runs before the question is sent to the AI model, before it is used to search our policy sources, and before it is written to our accuracy record.

> We do not store Social Security numbers, and we do not store any part of one. If you type a full number it is replaced outright before anything is saved, and so is a fragment like the last four digits. Nothing of it is kept, and none of it reaches the AI model.

> **The filter does not remove names. Detecting names automatically is unreliable, and a filter that guessed would mangle real questions. Please do not type your name or anyone else's.**

The filtered question is then sent to Anthropic, the company whose AI model writes Demeter's answers. Under the commercial terms we use, Anthropic processes the question to produce an answer and does not use it to train its models.

Anthropic keeps its own short-term copy for abuse prevention, on its own schedule and under its own terms. We tell you this because our deletion schedule below applies to our systems, and it would be misleading to describe it as if it reached everyone's.

We keep the filtered question and the answer because we make a specific promise about accuracy: that answers are grounded in real, cited regulations. A promise nobody checks is just a slogan. The record lets us find wrong answers and fix them. It is not linked to your name, and unless you have made an account, it is not linked to you at all.

## What we collect automatically

We never store your raw IP address. When a request arrives, the address is combined with a secret value and run through a one-way hash, and only a short piece of the result is kept. That fragment lets us count requests from the same source without being able to work backward to the address itself.

We use it for two things only: limiting how many questions can be asked in a minute, and limiting how much the service can spend in a day. It is not used to identify you, build a profile, or track you across other websites.

If the site hits an error, a report goes to Sentry, our error-monitoring provider, so we can fix the bug. We configure it to strip personal information before the report is sent.

We do not use advertising cookies, and we do not embed advertising or analytics trackers that follow you to other sites.

## Accounts are optional

The chat is free and anonymous, and it stays that way. You are never made to sign in to ask a question. An account does exactly one thing: it lets you come back to a conversation you already had.

If you make one, we collect your email address and nothing else. You sign in with a link we email you, so there is no password for us to store or for anyone to steal.

Saved conversations are protected at the database level, not just by our code: the database itself refuses to return a conversation to anyone but the account that saved it.

The working estimate Demeter builds up as you talk (your household, income and rent figures) is deliberately never saved to our servers, even when you save the conversation. It lives in your browser, and it is rebuilt from the conversation if you come back.

## The outline we email you

If you ask Demeter to email you the outline of your application, it goes to the email address on your account and to no other address. There is no field to type a different recipient, on purpose: the outline gathers your household and income details into one document, and a form that let anyone type any address would be a way to mail someone else's situation anywhere.

The email is delivered by Resend, our email provider.

## Immigration status

Fear of immigration consequences keeps eligible families, especially families where some members are citizens and some are not, from applying for food assistance they are legally entitled to. So we want to be direct about this.

> We are not a government agency. We are not part of the Department of Homeland Security, USCIS, or any immigration authority, and we never voluntarily share information with them.

Demeter does not ask for your immigration status and does not store it. If you mention it while asking a question, it lives in the accuracy record for the same short period as everything else and is not connected to your identity.

Asking Demeter a question is not an application, is not reported to anyone, and creates no record with any government agency.

We will not promise you something we could be forced to break. Any company can be served with a valid court order. What we can promise is that we have built this so there is little to take: no name, no immigration status, no reversible IP address, and, for anyone using the chat without an account, nothing tying a question to a person at all. We would require valid legal process, give only what it actually compels, and challenge anything overbroad. See the next section.

## Who else sees this

We share information with the companies that run the service for us, and with nobody else. Each is bound by contract to use it only to provide their service to us:

- Anthropic: the AI model that writes the answers
- Supabase: our database and sign-in system
- Vercel: hosting for the website
- Resend: sending the outline email
- Sentry: error monitoring

We do not sell personal information. We do not share it for advertising or for cross-context behavioral advertising, as those terms are defined by California law. We have no advertisers, and we do not license user data to anyone.

We may publish aggregate figures: for example, how many questions were asked about a given topic, or how often answers cited a verified state source. These are counts, and they cannot be traced back to any person.

## Government and legal requests

We have never received a government request for user information. If we receive one, we will require valid legal process, disclose only what that process actually compels, and, unless a court forbids it or there is a risk to someone's safety, tell the affected person.

The strongest protection here is not a promise, it is the design: the chat is anonymous, the IP address is never stored in a form we can reverse, and the questions we hold have had identifiers stripped out. For most conversations there is simply no identity for us to hand over.

Federal law separately protects the confidentiality of SNAP applicant information (7 U.S.C. § 2020(e)(8) and 7 C.F.R. § 272.1(c)). Where we handle information for a state agency or a partner organization under an agreement, we handle it under those restrictions as well as this policy.

## How long we keep things

Three different rules, depending on what it is.

- Deleted automatically: the text of questions and answers in our accuracy record, after 7 days. If an answer was flagged for review, for example because it cited something we could not verify, the row is kept for 30 days so a person can look at it.
- Kept until you delete it: your account, and any conversation you chose to save. Delete either one and it is gone from our systems within 30 days.
- Kept longer, for narrow reasons: records we need to keep to meet a legal obligation, to resolve a dispute, or to deal with abuse of the service. We keep only what the reason requires, and only while it applies.

Counts and measurements that identify nobody (how many questions were asked, how often citations verified) are kept indefinitely, because they are how we show the service works. We keep that data in de-identified form, we do not attempt to re-identify it, and we require anyone we share it with to do the same.

## Security, and what happens if we get it wrong

Information is encrypted in transit and at rest. Saved conversations are walled off at the database level rather than only in our code. Sign-in uses an emailed link, so there is no password of yours for us to lose. Access to the accuracy record is limited to the people who review answers for accuracy.

No system is perfectly secure, and we will not claim otherwise. If personal information is ever exposed in a way that puts you at risk, we will notify you and the authorities we are required to notify, without unreasonable delay, and tell you what happened and what to do about it.

## Your choices and your rights

In the chat, you can start a new conversation at any time. That clears the conversation from your browser. It does not erase the accuracy record, which expires on its own schedule above. We say so plainly rather than letting a button imply more than it does.

If you have an account, you can delete any saved conversation, or delete the account entirely, from your account page.

Some states give their residents the right to know what personal information a company holds about them, to get a copy, to correct it, to delete it, and not to be treated differently for asking.

> We extend those rights to everyone who uses Demeter, whatever state you live in and whatever your immigration status. We are not going to ask you to prove you live somewhere before we will delete your data.

To exercise any of them, email us at privacy@civica.app. We will respond within 45 days. If we need to refuse a request, we will tell you why, and you can ask us to reconsider by replying to that answer.

One honest limitation: for anonymous chat we usually cannot connect a request to a specific conversation, because we did not keep anything that ties the conversation to you. We will not ask you for identifying information just to create a link that did not exist before.

## Do not sell or share my personal information

We do not sell personal information, and we do not share it for cross-context behavioral advertising. There is nothing to opt out of, and this is a statement of practice, not a setting we could quietly change without updating this page.

If you believe otherwise, tell us at privacy@civica.app and we will look into it and answer you.

## Children and teenagers

Demeter answers questions about a household benefit, and teenagers are part of households. Some of them are the person in the family who reads the mail and figures out the forms. So we do not bar anyone from asking a question.

Demeter is a general-audience service about a household benefit program. It is not designed for or directed to children, it carries no advertising, and it has no features meant to appeal to them.

We do not knowingly collect personal information from children under 13, and accounts are not available to them. If you believe a child under 13 has given us personal information, email privacy@civica.app and we will delete it promptly.

## Changes to this policy

If we change this policy we will update the date at the top. If a change materially reduces the protections described here, we will say so prominently on the site rather than relying on you to notice a new date.

## Contact us

Demeter is operated by Civica Technologies LLC. For any privacy question, or to exercise a right described above, email privacy@civica.app.
