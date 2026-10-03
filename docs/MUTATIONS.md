# Mutations

Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. 66 defences in
`contracts/redline.py` were each broken on their own, and every mutant was caught. Each row
names the first test that failed against it, read from pytest's report rather than an exit code.
The generated-files and deployed-record tests are excluded, because they fail for any edit at all.

| # | defence broken | caught by |
|---|---|---|
| 1 | builder check: anyone passes | `tests/test_direct.py::test_top_up_is_the_builder_s_and_grows_the_bounty` |
| 2 | builder check: addresses compared as text | `tests/test_static.py::test_the_builder_check_compares_addresses` |
| 3 | attack: the builder may attack their own target | `tests/test_direct.py::test_attack_refusals` |
| 4 | create: the target is recorded as nobody's | `tests/test_direct.py::test_post_a_target_with_its_bounty` |
| 5 | attack: the hunter is not recorded | `tests/test_direct.py::test_an_attack_is_queued_and_its_fee_held_in_escrow` |
| 6 | judge: the caller is not recorded | `tests/test_static.py::test_the_open_write_records_who_called` |
| 7 | claim: pays a fixed address | `tests/test_direct.py::test_claim_pays_the_winner_the_bounty_and_their_own_fee` |
| 8 | claim: anyone takes the bounty | `tests/test_direct.py::test_a_queued_attack_on_a_closed_target_is_refunded_by_claim` |
| 9 | claim: the bounty is paid twice | `tests/test_direct.py::test_claim_pays_the_winner_the_bounty_and_their_own_fee` |
| 10 | claim: a refund is paid twice | `tests/test_direct.py::test_claim_pays_the_winner_the_bounty_and_their_own_fee` |
| 11 | claim: a held fee is refunded too | `tests/test_direct.py::test_claim_pays_the_winner_the_bounty_and_their_own_fee` |
| 12 | claim: a queued fee is refunded while the target is open | `tests/test_direct.py::test_claim_on_an_open_target_with_nothing_owed_is_refused` |
| 13 | claim: nothing due still sends | `tests/test_direct.py::test_claim_pays_the_winner_the_bounty_and_their_own_fee` |
| 14 | claim: the winner's own fee is kept | `tests/test_direct.py::test_claim_pays_the_winner_the_bounty_and_their_own_fee` |
| 15 | reclaim: before the lock ends | `tests/test_direct.py::test_reclaim_after_the_lock_returns_the_bounty_with_held_fees` |
| 16 | reclaim: a broken target's bounty | `tests/test_direct.py::test_a_broken_target_cannot_be_reclaimed` |
| 17 | reclaim: twice | `tests/test_direct.py::test_reclaim_after_the_lock_returns_the_bounty_with_held_fees` |
| 18 | reclaim: held fees stay behind | `tests/test_direct.py::test_reclaim_after_the_lock_returns_the_bounty_with_held_fees` |
| 19 | reclaim: the target stays open | `tests/test_direct.py::test_reclaim_after_the_lock_returns_the_bounty_with_held_fees` |
| 20 | attack: any fee is accepted | `tests/test_direct.py::test_attack_refusals` |
| 21 | attack: a fee above the entry fee is accepted | `tests/test_direct.py::test_attack_refusals` |
| 22 | attack: a closed target takes attacks | `tests/test_direct.py::test_the_first_break_closes_the_target_and_later_attacks_are_void` |
| 23 | attack: open after the lock | `tests/test_direct.py::test_an_attack_after_the_lock_is_refused` |
| 24 | attack: a queued fee is not held in escrow | `tests/test_direct.py::test_an_attack_is_queued_and_its_fee_held_in_escrow` |
| 25 | create: no bounty needed | `tests/test_direct.py::test_posting_refusals[kwargs24-send` |
| 26 | create: a six-day lock | `tests/test_direct.py::test_posting_refusals[kwargs22-7` |
| 27 | create: a free entry | `tests/test_direct.py::test_posting_refusals[kwargs20-entry` |
| 28 | top_up: a closed target | `tests/test_direct.py::test_reclaim_after_the_lock_returns_the_bounty_with_held_fees` |
| 29 | attack: the length limit is gone | `tests/test_direct.py::test_a_too_long_attack_is_rejected_before_any_model_runs` |
| 30 | attack: canary-shaped strings pass | `tests/test_direct.py::test_a_list_of_canary_shaped_strings_is_rejected` |
| 31 | canary shape: thirteen characters count | `tests/test_direct.py::test_canary_shape[KQ7MZ3TR9AW4X-False]` |
| 32 | canary shape: a digit is not needed | `tests/test_direct.py::test_canary_shape[abcdefghijkl-False]` |
| 33 | policy: keys pass | `tests/test_direct.py::test_key_shaped_strings_are_refused_at_posting[sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA]` |
| 34 | policy: harmful topics pass | `tests/test_direct.py::test_targets_about_harmful_output_are_refused[bomb]` |
| 35 | policy: matched inside other words | `tests/test_direct.py::test_harmless_words_that_contain_a_listed_word_pass` |
| 36 | rules: a fourth rule | `tests/test_direct.py::test_posting_refusals[kwargs8-one` |
| 37 | rules: two of one kind | `tests/test_direct.py::test_posting_refusals[kwargs9-two` |
| 38 | rules: the mode's own kind is optional | `tests/test_direct.py::test_posting_refusals[kwargs12-action` |
| 39 | rules: a secret rule with no slot | `tests/test_direct.py::test_a_secret_rule_needs_the_slot_and_the_slot_needs_a_secret_rule` |
| 40 | rules: the allowlist is not normalised | `tests/test_direct.py::test_action_checks_are_exact_code[{"action":` |
| 41 | secret: the canary must match exactly, no squash | `tests/test_direct.py::test_a_reply_with_the_canary_breaks_the_secret_rule[lowercase:` |
| 42 | secret: the rule is never checked | `tests/test_direct.py::test_a_reply_with_the_canary_breaks_the_secret_rule[Sure,` |
| 43 | action: the limit allows anything | `tests/test_direct.py::test_action_checks_are_exact_code[{"action":` |
| 44 | action: off by one at the limit | `tests/test_direct.py::test_action_checks_are_exact_code[{"action":` |
| 45 | action: the allowlist is ignored | `tests/test_direct.py::test_action_checks_are_exact_code[{"action":` |
| 46 | action: an action with no amount holds | `tests/test_direct.py::test_action_checks_are_exact_code[{"action":` |
| 47 | action: negative amounts hold | `tests/test_direct.py::test_action_checks_are_exact_code[{"action":` |
| 48 | action: only the first action is read | `tests/test_direct.py::test_action_checks_are_exact_code[{"action":` |
| 49 | action: string amounts are not read | `tests/test_direct.py::test_post_a_target_with_its_bounty` |
| 50 | verdict: the highest broken rule wins | `tests/test_direct.py::test_the_judge_runs_only_when_its_answer_can_change_the_verdict` |
| 51 | verdict: the judge is never asked | `tests/test_direct.py::test_a_scope_break_is_judged` |
| 52 | judge: the fence lets delimiters through | `tests/test_static.py::test_the_agent_blocks_close_where_the_contract_closes_them` |
| 53 | judge: the attack reaches the agent unfenced | `tests/test_static.py::test_the_agent_prompt_is_joined_from_fenced_text_and_contract_constants` |
| 54 | judge: the reply reaches the judge unfenced | `tests/test_static.py::test_every_scope_prompt_value_is_fenced` |
| 55 | judge: the canary is filled before fencing | `tests/test_static.py::test_the_agent_prompt_is_joined_from_fenced_text_and_contract_constants` |
| 56 | judge: validators agree with any verdict | `tests/test_direct.py::test_a_break_that_does_not_reproduce_never_pays` |
| 57 | judge: an unreadable verdict defaults to HELD | `tests/test_direct.py::test_an_unreadable_judge_is_a_disagreement_and_writes_nothing` |
| 58 | judge: no retry on a formatting slip | `tests/test_direct.py::test_a_judge_formatting_slip_is_retried_once` |
| 59 | judge: the stored reply keeps the canary | `tests/test_direct.py::test_the_canary_is_never_stored` |
| 60 | judge: the reply is not cut | `tests/test_direct.py::test_the_stored_reply_is_the_leader_s_cut_to_400` |
| 61 | judge: one canary for every judgment | `tests/test_direct.py::test_the_canary_comes_from_the_judging_transaction` |
| 62 | judge: a judged attack is judged again | `tests/test_direct.py::test_a_list_of_canary_shaped_strings_is_rejected` |
| 63 | judge: a broken target keeps running attacks | `tests/test_direct.py::test_the_first_break_closes_the_target_and_later_attacks_are_void` |
| 64 | judge: a break does not close the target | `tests/test_direct.py::test_the_first_break_closes_the_target_and_later_attacks_are_void` |
| 65 | judge: a held fee is not added to the bounty | `tests/test_direct.py::test_held_attacks_grow_the_bounty` |
| 66 | judge: writes before the block runs | `tests/test_direct.py::test_an_unreadable_judge_is_a_disagreement_and_writes_nothing` |
