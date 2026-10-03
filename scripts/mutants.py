"""
The mutants scripts/mutate.py runs: one defence of contracts/redline.py broken each.

(what the mutant does, text in the contract, what replaces it). Each text must
occur exactly once, so a mutant always changes exactly one place.
"""

MUTANTS = [
    # who may write
    ("builder check: anyone passes", "        if t.builder != gl.message.sender_address:\n", "        if False:\n"),
    ("builder check: addresses compared as text", "if t.builder != gl.message.sender_address:", "if t.builder.as_hex != gl.message.sender_address.as_hex.lower():"),
    ("attack: the builder may attack their own target", "        if t.builder == me:\n", "        if False:\n"),
    ("create: the target is recorded as nobody's", "builder=gl.message.sender_address,", "builder=ZERO,"),
    ("attack: the hunter is not recorded", "            hunter=me,\n", "            hunter=ZERO,\n"),
    ("judge: the caller is not recorded", "        a.judged_by = gl.message.sender_address\n        t.queued", "        t.queued"),
    ("claim: pays a fixed address", "_Payee(me).emit_transfer(value=u256(due))", "_Payee(ZERO).emit_transfer(value=u256(due))"),
    ("claim: anyone takes the bounty", "        if t.status == BROKEN and t.winner == me and not t.paid:", "        if t.status == BROKEN and not t.paid:"),
    ("claim: the bounty is paid twice", "        if t.status == BROKEN and t.winner == me and not t.paid:", "        if t.status == BROKEN and t.winner == me:"),
    ("claim: a refund is paid twice", "                if a.refunded:\n                    continue\n", ""),
    ("claim: a held fee is refunded too", "                if a.status in (REJECTED, VOID, BROKEN):", "                if a.status in (REJECTED, VOID, BROKEN, HELD):"),
    ("claim: a queued fee is refunded while the target is open", "                if a.status == QUEUED and t.status != OPEN:", "                if a.status == QUEUED:"),
    ("claim: nothing due still sends", '        if due <= 0:\n            raise gl.vm.UserError(E + "nothing to claim on this target")', '        if due < 0:\n            raise gl.vm.UserError(E + "nothing to claim on this target")'),
    ("claim: the winner's own fee is kept", "                if a.status in (REJECTED, VOID, BROKEN):", "                if a.status in (REJECTED, VOID):"),
    ("reclaim: before the lock ends", "        if now < int(t.lock_until):", "        if False:"),
    ("reclaim: a broken target's bounty", '        if t.status == BROKEN:\n            raise gl.vm.UserError(E + "this target was broken', '        if False:\n            raise gl.vm.UserError(E + "this target was broken'),
    ("reclaim: twice", '        if t.status != OPEN:\n            raise gl.vm.UserError(E + "this bounty has already been reclaimed")', '        if False:\n            raise gl.vm.UserError(E + "this bounty has already been reclaimed")'),
    ("reclaim: held fees stay behind", "        due = int(t.posted) + int(t.fees_in)\n        t.status = CLOSED", "        due = int(t.posted)\n        t.status = CLOSED"),
    ("reclaim: the target stays open", "        t.status = CLOSED\n", ""),
    # money in
    ("attack: any fee is accepted", "        if int(gl.message.value) != int(t.entry_fee):", "        if int(gl.message.value) < 0:"),
    ("attack: a fee above the entry fee is accepted", "        if int(gl.message.value) != int(t.entry_fee):", "        if int(gl.message.value) < int(t.entry_fee):"),
    ("attack: a closed target takes attacks", '            raise gl.vm.UserError(E + "a builder cannot attack their own target")\n        if t.status != OPEN:', '            raise gl.vm.UserError(E + "a builder cannot attack their own target")\n        if False:'),
    ("attack: open after the lock", "        if now >= int(t.lock_until):\n            raise gl.vm.UserError(E + \"this target's attack window", "        if False:\n            raise gl.vm.UserError(E + \"this target's attack window"),
    ("attack: a queued fee is not held in escrow", "            t.escrow = u256(int(t.escrow) + fee)\n", ""),
    ("create: no bounty needed", '        if value <= 0:\n            raise gl.vm.UserError(E + "send the bounty with the post")', '        if value < 0:\n            raise gl.vm.UserError(E + "send the bounty with the post")'),
    ("create: a six-day lock", "MIN_LOCK_DAYS = 7", "MIN_LOCK_DAYS = 6"),
    ("create: a free entry", "or entry_fee <= 0:", "or entry_fee < 0:"),
    (
        "top_up: a closed target",
        '        if t.status != OPEN:\n            raise gl.vm.UserError(E + "this target is closed")\n        value = int(gl.message.value)\n        if value <= 0:\n            raise gl.vm.UserError(E + "send some GEN to top up',
        '        value = int(gl.message.value)\n        if value <= 0:\n            raise gl.vm.UserError(E + "send some GEN to top up',
    ),
    # exact checks before any model
    ("attack: the length limit is gone", "        if len(body) > MAX_ATTACK:", "        if False:"),
    ("attack: canary-shaped strings pass", "        elif canary_shaped(body):", "        elif False:"),
    ("canary shape: thirteen characters count", "        if len(token) != CANARY_LENGTH:", "        if len(token) < CANARY_LENGTH:"),
    ("canary shape: a digit is not needed", "        if has_digit and has_letter:", "        if has_letter:"),
    # the rule policy
    ("policy: keys pass", '            return "this looks like a real key', '            continue\n            return "this looks like a real key'),
    ("policy: harmful topics pass", "    lowered = text.lower()\n", '    lowered = ""\n'),
    ("policy: matched inside other words", '        if re.search(r"\\b" + re.escape(word) + r"\\b", lowered) is not None:', "        if word in lowered:"),
    ("rules: a fourth rule", "MAX_RULES = 3", "MAX_RULES = 4"),
    ("rules: two of one kind", '        if rule["kind"] in seen:', "        if False:"),
    ("rules: the mode's own kind is optional", "    if MODE_KIND[mode] not in seen:", "    if False:"),
    ("rules: a secret rule with no slot", '    if "secret" in seen and SLOT not in instructions:', "    if False:"),
    ("rules: the allowlist is not normalised", '    return " ".join(str(raw if raw is not None else "").split()).lower()', '    return str(raw if raw is not None else "")'),
    # the checks
    ("secret: the canary must match exactly, no squash", "            if canary.lower() in squash(reply):", "            if canary in reply:"),
    ("secret: the rule is never checked", '        if rule["kind"] == "secret":\n            if canary.lower() in squash(reply):', '        if rule["kind"] == "secret":\n            if False:'),
    ("action: the limit allows anything", "        if amount > limit:", "        if False:"),
    ("action: off by one at the limit", "        if amount > limit:", "        if amount >= limit:"),
    ("action: the allowlist is ignored", '        if len(allow) > 0 and _recipient(act.get("to")) not in allow:', "        if False:"),
    ("action: an action with no amount holds", '            return "The reply took a " + kind[:20] + " action with no amount the limit can check."', "            continue"),
    ("action: negative amounts hold", "        if amount < 0:", "        if False:"),
    ("action: only the first action is read", '        index = text.find("{", end)', "        break"),
    ("action: string amounts are not read", "    elif isinstance(raw, str):", "    elif False:"),
    ("verdict: the highest broken rule wins", "        if scope_number > 0 and (number == 0 or scope_number < number):", "        if scope_number > 0:"),
    ("verdict: the judge is never asked", "        if scope_number > 0 and (number == 0 or scope_number < number):", "        if False:"),
    # the judge and the canary
    ("judge: the fence lets delimiters through", '    return str(raw).replace("<", "(").replace(">", ")")', "    return str(raw)"),
    ("judge: the attack reaches the agent unfenced", "AGENT_MIDDLE + fence(attack) + AGENT_TAIL", "AGENT_MIDDLE + attack + AGENT_TAIL"),
    ("judge: the reply reaches the judge unfenced", "reply=fence(reply))", "reply=reply)"),
    ("judge: the canary is filled before fencing", "fence(instructions).replace(SLOT, canary)", "fence(instructions.replace(SLOT, canary))"),
    ("judge: validators agree with any verdict", '        return mine["verdict"] == theirs.get("verdict")', "        return True"),
    ("judge: an unreadable verdict defaults to HELD", '    if verdict not in (BROKEN, HELD):\n        raise gl.vm.UserError(L + "bad verdict")', "    if verdict not in (BROKEN, HELD):\n        verdict = HELD"),
    ("judge: no retry on a formatting slip", "        if not error_text(first).startswith(L):\n            raise", "        raise"),
    ("judge: the stored reply keeps the canary", '"reply": mask(reply, canary)[:MAX_REPLY]', '"reply": reply[:MAX_REPLY]'),
    ("judge: the reply is not cut", '"reply": mask(reply, canary)[:MAX_REPLY]', '"reply": mask(reply, canary)'),
    ("judge: one canary for every judgment", "            str(when),\n", ""),
    ("judge: a judged attack is judged again", '        if a.status != QUEUED:\n            raise gl.vm.UserError(E + "this attack is not queued', '        if a.status == VOID:\n            raise gl.vm.UserError(E + "this attack is not queued'),
    ("judge: a broken target keeps running attacks", "        if t.status != OPEN:\n            self._void(", "        if False:\n            self._void("),
    ("judge: a break does not close the target", "            t.status = BROKEN\n", ""),
    ("judge: a held fee is not added to the bounty", "            t.fees_in = u256(int(t.fees_in) + int(a.fee))\n", ""),
    (
        "judge: writes before the block runs",
        "        out = run_judgment(t.instructions, json.loads(t.rules), a.text, seed)\n",
        "        a.judged_at = u64(now)\n        out = run_judgment(t.instructions, json.loads(t.rules), a.text, seed)\n",
    ),
]
