import { tableHelper } from 'typeorm-extensions';

class Image {
  id: number;
  url: string;
  createdAt: Date;
}

const image = tableHelper<Image>('image');

image.jsonBuildObject(['id', 'url']);
image.jsonBuildObject({ imageId: 'id', src: 'url' });
image.jsonAgg(image.column('url'), { orderBy: ['createdAt', 'DESC'] });
image.jsonAgg(image.column('url'), { orderBy: 'id' });

// @ts-expect-error not a column of the entity
image.jsonBuildObject(['id', 'path']);
// @ts-expect-error a key mapped to a column the entity doesn't have
image.jsonBuildObject({ src: 'path' });
// @ts-expect-error ordered by a column the entity doesn't have
image.jsonAgg(image.column('url'), { orderBy: ['position', 'DESC'] });
// @ts-expect-error not a direction
image.jsonAgg(image.column('url'), { orderBy: ['id', 'UP'] });
