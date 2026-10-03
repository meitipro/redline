import type { Metadata } from 'next';

import { PostForm } from '@/components/PostForm';

export const metadata: Metadata = {
  title: 'Post a target',
  description: "Post a test version of your agent's instructions, its rules and a locked bounty.",
};

export default function NewTarget() {
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Post a target</p>
      <h1 className="c-h2 mt-2">Put your agent&apos;s rules in front of many attackers</h1>
      <p className="c-lead mt-4">
        One to three rules about secrets, actions or scope, a bounty locked for at least seven days, and an entry fee per
        attack. Every attempt, held or broken, stays on the public record.
      </p>
      <div className="mt-10">
        <PostForm />
      </div>
    </div>
  );
}
