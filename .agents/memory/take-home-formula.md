---
name: Take-home pay formula
description: Why take-home uses grossIncomeTax + additionalRelief instead of effectiveIncomeTax
---

takeHomePay = totalEarnings - grossIncomeTax + totalAdditionalRelief - class1NI - class4NI - studentLoan - netContribution - netGiftAid

**Why:** For relief-at-source pensions, PAYE collects tax on gross earnings (grossIncomeTax). The basic rate relief (20%) goes directly from HMRC to the pension provider — it never touches the individual's bank. The additional relief (above 20%) comes back as a self-assessment refund. So the individual's bank sees: gross tax collected minus SA refund. Using effectiveIncomeTax (which nets off ALL relief) would undercount take-home by the basicRateRelief amount.

**How to apply:** Budget check: takeHome + grossPension + grossGiftAid + (grossIncomeTax - basicRateRelief - giftAidBasicRelief - additionalRelief) + class1NI + class4NI + studentLoan = totalEarnings. The "bucket" cards show grossPension and grossGiftAid (which include the HMRC top-up), not the net contributions.
