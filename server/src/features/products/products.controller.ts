import { Request, Response, NextFunction } from 'express';
import { ProductsService } from './products.service';
import { CreateProductSchema, UpdateProductSchema, ProductQuerySchema, UpdateVariantsSchema } from './products.schema';

export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = ProductQuerySchema.parse(req.query);
      const result = await this.productsService.listProducts(query);

      res.status(200).json({
        data: result.data,
        pagination: result.pagination,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.productsService.getProduct(req.params.id as string);

      res.status(200).json({
        data: product,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  filters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = await this.productsService.getFilters();

      res.status(200).json({
        data: filters,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  featured = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await this.productsService.getFeaturedProducts();

      res.status(200).json({
        data: products,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = CreateProductSchema.parse(req.body);
      const product = await this.productsService.createProduct(dto);

      res.status(201).json({
        data: product,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = UpdateProductSchema.parse(req.body);
      const product = await this.productsService.updateProduct(req.params.id as string, dto);

      res.status(200).json({
        data: product,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.productsService.deleteProduct(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  completeLook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await this.productsService.getCompleteLook(req.params.id as string);

      res.status(200).json({
        data: products,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variants = await this.productsService.getVariants(req.params.id as string);

      res.status(200).json({
        data: variants,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = UpdateVariantsSchema.parse(req.body);
      const variants = await this.productsService.updateVariants(
        req.params.id as string,
        dto.variants,
      );

      res.status(200).json({
        data: variants,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
