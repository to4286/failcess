import { User, Post } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    email: 'sarah@example.com',
    nickname: 'Sarah Chen',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    bio: 'Former fintech founder. Now helping others avoid my mistakes.',
  },
  {
    id: '2',
    email: 'marcus@example.com',
    nickname: 'Marcus Johnson',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    bio: 'Serial entrepreneur. 3 failures, 1 exit. Learning every day.',
  },
  {
    id: '3',
    email: 'elena@example.com',
    nickname: 'Elena Rodriguez',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    bio: 'Built and lost a $10M company. Here to share the lessons.',
  },
  {
    id: '4',
    email: 'david@example.com',
    nickname: 'David Park',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    bio: 'Former YC founder. Pivoted 5 times before shutting down.',
  },
];

export const mockPosts: Post[] = [
  {
    id: '1',
    title: 'How I Burned Through $2M in 18 Months',
    content: 'When we raised our Series A, I thought we had made it. The money felt endless, and we started spending like it was. New offices, aggressive hiring, expensive tools we didn\'t need. Looking back, the signs were there from day one. Our burn rate was unsustainable, but I was too caught up in the growth narrative to see it. The hardest lesson? Sometimes the best thing you can do for your company is to slow down and focus on fundamentals. We hired 40 people in 6 months, but we should have focused on finding product-market fit first.',
    author_id: '1',
    author: mockUsers[0],
    save_count: 234,
    comment_count: 45,
    view_count: 1892,
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'The Marketing Campaign That Almost Killed Us',
    content: 'We spent $500K on a Super Bowl adjacent campaign thinking it would put us on the map. It did—but for all the wrong reasons. Our servers crashed, customer support was overwhelmed, and the viral moment turned into a PR nightmare. The lesson here isn\'t that bold marketing is bad. It\'s that you need to be operationally ready for success. We had the marketing muscle but not the infrastructure to support it.',
    author_id: '2',
    author: mockUsers[1],
    save_count: 189,
    comment_count: 32,
    view_count: 1456,
    created_at: '2024-01-12T14:30:00Z',
  },
  {
    id: '3',
    title: 'Why Our "Perfect" MVP Failed',
    content: 'We spent 14 months building what we thought was the perfect product. Every feature was polished, every edge case handled. When we finally launched, crickets. Nobody cared. The problem? We never talked to customers. We built what we wanted, not what the market needed. Now I advise founders to ship something ugly in 6 weeks and iterate. The market doesn\'t care about your perfect code.',
    author_id: '3',
    author: mockUsers[2],
    save_count: 312,
    comment_count: 67,
    view_count: 2341,
    created_at: '2024-01-10T09:15:00Z',
  },
  {
    id: '4',
    title: 'The Hiring Mistake That Cost Us Everything',
    content: 'I hired my best friend as CTO. It seemed like a no-brainer—we worked well together, trusted each other completely. But when things got tough, our friendship made it impossible to have hard conversations. Performance issues went unaddressed. By the time I realized we needed a change, it was too late. The company culture had fractured, and we lost our best engineers. Never hire someone you can\'t fire.',
    author_id: '4',
    author: mockUsers[3],
    save_count: 276,
    comment_count: 89,
    view_count: 1987,
    created_at: '2024-01-08T16:45:00Z',
  },
  {
    id: '5',
    title: 'Ignoring Red Flags: A Founder\'s Confession',
    content: 'The investors were asking hard questions, the team was burning out, and customers were churning. But I kept pushing forward, convinced that the next feature, the next hire, the next round would fix everything. It took losing everything to realize that sometimes the bravest thing a founder can do is admit defeat and pivot early. Don\'t let ego kill your company.',
    author_id: '1',
    author: mockUsers[0],
    save_count: 198,
    comment_count: 54,
    view_count: 1654,
    created_at: '2024-01-05T11:20:00Z',
  },
];

export const currentUser: User = {
  id: 'current',
  email: 'me@example.com',
  nickname: 'Alex Thompson',
  avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
  bio: 'Building, failing, learning. Founder at stealth startup.',
};

export const followedUserIds: string[] = ['1', '3'];
